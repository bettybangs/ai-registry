"""Risk-tiering function for the AI Tool & Vendor Registry.

POST /api/tier with a JSON intake submission. Returns a numeric score,
a tier (Low, Medium, High, Critical), the factors that drove the score,
the review controls required for that tier, and a recommended starting
review status. High and Critical tools are flagged as requiring human
sign-off; nothing is ever rejected automatically.
"""
from http.server import BaseHTTPRequestHandler
import json

DATA_WEIGHTS = {
    "financial": 3,
    "health": 3,
    "credentials": 3,
    "pii": 2,
    "internal": 1,
    "public": 0,
}

ASSURANCE_WEIGHTS = {"soc2": 0, "iso27001": 0, "other": 1, "none": 2}

ACCESS_WEIGHTS = {"none": 0, "read": 1, "write": 2}

TIERS = [
    (2, "Low"),
    (5, "Medium"),
    (9, "High"),
    (999, "Critical"),
]

CONTROLS = {
    "Low": [
        "Register the tool and assign a business owner",
        "Confirm acceptable-use policy acknowledgment",
        "Annual re-attestation",
    ],
    "Medium": [
        "Complete the vendor security questionnaire",
        "Review vendor privacy policy and data-retention terms",
        "Confirm no training on company data (opt-out in place)",
        "Annual review",
    ],
    "High": [
        "Complete the vendor security questionnaire and review SOC 2 or ISO 27001 report",
        "Privacy review and data-processing agreement",
        "Security review of integrations and access scope",
        "Require human review of AI outputs used in decisions",
        "Semi-annual review",
    ],
    "Critical": [
        "Legal and Security sign-off required before any use",
        "Full vendor due diligence with report review and exceptions documented",
        "Data-processing agreement and data-flow mapping",
        "Access limited to least privilege with logging and monitoring",
        "Documented human oversight and incident-response contact",
        "Quarterly review",
    ],
}

# Starting review status by tier. Only Low risk is fast-tracked. Everything
# else waits for a person, and High and Critical need explicit sign-off.
STARTING_STATUS = {
    "Low": ("Approved", "Low risk: fast-tracked once registered with a business owner"),
    "Medium": ("In review", "Medium risk: needs a reviewer to complete the listed controls"),
    "High": ("In review", "High risk: human sign-off required before approval"),
    "Critical": ("Pending review", "Critical risk: Legal and Security sign-off required before any use"),
}


def tier_submission(data):
    score = 0
    factors = []

    data_types = data.get("data_types") or ["public"]
    if not isinstance(data_types, list):
        data_types = [data_types]
    weights = [DATA_WEIGHTS.get(d, 0) for d in data_types]
    data_score = max(weights) if weights else 0
    if len(data_types) > 2:
        data_score += 1
    score += data_score
    if data_score:
        factors.append(f"Data handled: {', '.join(data_types)} (+{data_score})")

    if data.get("customer_data"):
        score += 2
        factors.append("Involves customer data (+2)")

    if data.get("vendor_trains_on_data"):
        score += 2
        factors.append("Vendor may train models on company data (+2)")

    assurance = data.get("assurance", "none")
    a = ASSURANCE_WEIGHTS.get(assurance, 2)
    if a:
        score += a
        label = "No independent assurance report" if assurance == "none" else "Limited assurance evidence"
        factors.append(f"{label} (+{a})")

    access = data.get("system_access", "none")
    s = ACCESS_WEIGHTS.get(access, 0)
    if s:
        score += s
        factors.append(f"Integration access: {access} (+{s})")

    if data.get("automated_decisions"):
        score += 2
        factors.append("Outputs feed decisions without required human review (+2)")

    if data.get("users_count") == "organization":
        score += 1
        factors.append("Organization-wide use (+1)")

    tier = next(name for limit, name in TIERS if score <= limit)
    return {
        "score": score,
        "tier": tier,
        "factors": factors,
        "controls": CONTROLS[tier],
        "recommended_status": STARTING_STATUS[tier][0],
        "status_reason": STARTING_STATUS[tier][1],
        "requires_signoff": tier in ("High", "Critical"),
    }


class handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(data, dict):
                raise ValueError("Body must be a JSON object")
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"error": "Invalid JSON body"})
            return
        self._send(200, tier_submission(data))

    def do_GET(self):
        self._send(405, {"error": "Use POST"})
