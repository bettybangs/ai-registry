import React, { useEffect, useState } from "react";

const DATA_OPTIONS = [
  ["public", "Public information"],
  ["internal", "Internal business data"],
  ["pii", "Personal data (PII)"],
  ["financial", "Financial or payment data"],
  ["health", "Health data"],
  ["credentials", "Credentials or secrets"],
];

const STATUSES = ["Pending review", "In review", "Approved", "Rejected"];
const STORAGE_KEY = "ai-registry-entries-v1";

const emptyForm = {
  tool_name: "",
  vendor: "",
  owner: "",
  use_case: "",
  data_types: ["public"],
  customer_data: false,
  vendor_trains_on_data: false,
  assurance: "none",
  system_access: "none",
  automated_decisions: false,
  users_count: "team",
};

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable; registry stays in memory for this session */
  }
}

export default function App() {
  const [form, setForm] = useState(emptyForm);
  const [entries, setEntries] = useState(loadEntries);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => saveEntries(entries), [entries]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleData = (key) => {
    setForm((f) => {
      const has = f.data_types.includes(key);
      let next = has ? f.data_types.filter((d) => d !== key) : [...f.data_types, key];
      if (next.length === 0) next = ["public"];
      if (key !== "public" && next.includes("public") && next.length > 1) {
        next = next.filter((d) => d !== "public");
      }
      return { ...f, data_types: next };
    });
  };

  async function submit() {
    setError("");
    if (!form.tool_name.trim() || !form.vendor.trim() || !form.owner.trim()) {
      setError("Tool name, vendor, and business owner are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Tiering service returned " + res.status);
      const tiered = await res.json();
      const entry = {
        id: Date.now(),
        submitted: new Date().toISOString().slice(0, 10),
        status: "Pending review",
        ...form,
        ...tiered,
      };
      setEntries((e) => [entry, ...e]);
      setResult(entry);
      setForm(emptyForm);
    } catch (e) {
      setError("Could not assign a risk tier: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  const updateStatus = (id, status) =>
    setEntries((e) => e.map((x) => (x.id === id ? { ...x, status } : x)));
  const remove = (id) => setEntries((e) => e.filter((x) => x.id !== id));

  return (
    <div className="wrap">
      <h1>AI Tool & Vendor Registry</h1>
      <p className="sub">Submit a new AI tool for compliance and security review. A Python function assigns a risk tier and the controls required.</p>
      <div className="notice">
        Demo version: entries are stored in this browser only. Logins, a shared database, and email notifications are planned.
      </div>

      <h2>Submit an AI tool</h2>
      <div className="grid">
        <div>
          <label>Tool name</label>
          <input type="text" value={form.tool_name} onChange={(e) => set("tool_name", e.target.value)} />
        </div>
        <div>
          <label>Vendor</label>
          <input type="text" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
        </div>
        <div>
          <label>Business owner</label>
          <input type="text" value={form.owner} onChange={(e) => set("owner", e.target.value)} />
        </div>
        <div>
          <label>Who will use it</label>
          <select value={form.users_count} onChange={(e) => set("users_count", e.target.value)}>
            <option value="individual">Individual</option>
            <option value="team">One team</option>
            <option value="organization">Organization-wide</option>
          </select>
        </div>
        <div className="full">
          <label>Use case</label>
          <textarea value={form.use_case} onChange={(e) => set("use_case", e.target.value)} />
        </div>
        <div className="full">
          <label>Data the tool will handle</label>
          <div className="checks">
            {DATA_OPTIONS.map(([key, text]) => (
              <label key={key}>
                <input type="checkbox" checked={form.data_types.includes(key)} onChange={() => toggleData(key)} />
                {text}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label>Independent assurance report</label>
          <select value={form.assurance} onChange={(e) => set("assurance", e.target.value)}>
            <option value="none">None available</option>
            <option value="soc2">SOC 2 report</option>
            <option value="iso27001">ISO 27001 certificate</option>
            <option value="other">Other / self-attested</option>
          </select>
        </div>
        <div>
          <label>Access to internal systems</label>
          <select value={form.system_access} onChange={(e) => set("system_access", e.target.value)}>
            <option value="none">None</option>
            <option value="read">Read access</option>
            <option value="write">Write access</option>
          </select>
        </div>
        <div className="checks full">
          <label><input type="checkbox" checked={form.customer_data} onChange={(e) => set("customer_data", e.target.checked)} /> Involves customer data</label>
          <label><input type="checkbox" checked={form.vendor_trains_on_data} onChange={(e) => set("vendor_trains_on_data", e.target.checked)} /> Vendor may train models on our data</label>
          <label><input type="checkbox" checked={form.automated_decisions} onChange={(e) => set("automated_decisions", e.target.checked)} /> Outputs feed decisions without required human review</label>
        </div>
      </div>
      <p><button onClick={submit} disabled={busy}>{busy ? "Assigning tier..." : "Submit for review"}</button></p>
      {error && <div className="err">{error}</div>}

      {result && (
        <div className="result">
          <strong>{result.tool_name}</strong> assigned <span className={"pill " + result.tier}>{result.tier}</span> (score {result.score})
          <div style={{ marginTop: 8 }}><strong>Why</strong></div>
          <ul>{result.factors.length ? result.factors.map((f) => <li key={f}>{f}</li>) : <li>No elevated risk factors</li>}</ul>
          <div style={{ marginTop: 8 }}><strong>Required review controls</strong></div>
          <ul>{result.controls.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}

      <h2>Registry ({entries.length})</h2>
      {entries.length === 0 ? (
        <p className="sub">No tools submitted yet.</p>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Tool</th><th>Vendor</th><th>Owner</th><th>Tier</th><th>Status</th><th>Submitted</th><th></th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.tool_name}</td>
                  <td>{e.vendor}</td>
                  <td>{e.owner}</td>
                  <td><span className={"pill " + e.tier}>{e.tier}</span></td>
                  <td>
                    <select value={e.status} onChange={(ev) => updateStatus(e.id, ev.target.value)}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>{e.submitted}</td>
                  <td><button className="ghost" onClick={() => remove(e.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
