import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { AccountCard, CloudDeleteCard, ImportCard, VerificationCard } from "../components/CloudPanels";
import { UsernameCard } from "../components/Social";
import { Avatar, NAV_ENTRIES } from "../components/Layout";
import { Card, Disclaimer, Locked } from "../components/ui";
import { CONDITION_LABEL, PAL } from "../lib/nutrition";
import { bodySummary, fmt } from "../state/derived";
import { clearInterventionsPreview } from "../state/interventions";
import { CloudProCard } from "./Pro";
import { canUseWorkbench, useStore } from "../state/store";

const ROLE_LABEL = { consumer: "Member", student: "Nutrition student", dietitian: "Dietitian" };

export function Me() {
  const navigate = useNavigate();
  const { profile, latestWeightKg, dietitianTarget, updateProfile, resetAll, mode, account } = useStore();
  const cloud = mode === "cloud";
  if (!profile || latestWeightKg === null) return null;
  const s = bodySummary(profile, latestWeightKg, dietitianTarget);
  const isPro = profile.role !== "consumer";

  return (
    <div className="page">
      <header className="page-head" style={{ justifyContent: "flex-start" }}>
        <Avatar name={profile.name} />
        <div className="page-head-title">
        <h1>{profile.name}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {cloud && profile.username && <span className="handle">@{profile.username} · </span>}
          {ROLE_LABEL[profile.role]}
          {profile.verification === "verified" && <span className="badge badge-ok"> ✓ Verified</span>}
          {profile.verification === "pending" && <span className="badge"> Verification pending</span>}
          {profile.verification === "rejected" && <span className="badge"> Verification needs attention</span>}
        </p>
        </div>
      </header>

      {cloud && <ImportCard />}
      {cloud && <UsernameCard />}

      <section className="more-grid" aria-label="All features">
        {NAV_ENTRIES.filter((n) => n.to !== "/home").map((n) => (
          <Link key={n.to} to={n.to} className="more-item">
            <span className="more-icon"><n.icon size={20} /></span>
            <span>{n.label}</span>
          </Link>
        ))}
      </section>

      <Card title="My details">
        <dl className="details">
          <dt>Age</dt><dd>{s.ageYears}</dd>
          <dt>Height</dt><dd>{profile.heightCm} cm</dd>
          <dt>Weight</dt><dd>{fmt(latestWeightKg, 1)} kg</dd>
          <dt>Activity</dt><dd>{PAL[profile.activity].consumerLabel}</dd>
          <dt>Conditions</dt><dd>{profile.conditions.length ? profile.conditions.map((c) => CONDITION_LABEL[c]).join(", ") : "None"}</dd>
          <dt>Daily target</dt><dd>{s.target.kind === "target" ? `about ${fmt(s.target.kcal)} kcal` : "Set by a dietitian"}</dd>
        </dl>
      </Card>

      {cloud && isPro && <VerificationCard />}
      {cloud && account?.isAdmin && (
        <Card title="Admin" className="card-accent">
          <p className="small" style={{ marginTop: 0 }}>Review student and dietitian verification requests.</p>
          <button className="btn btn-primary" onClick={() => navigate("/admin")}>Open review queue</button>
        </Card>
      )}

      {cloud && profile.role === "dietitian" && profile.verification === "verified" && <CloudProCard />}
      {canUseWorkbench(profile) ? (
        <Card title="Professional tools" className="card-accent">
          <div className="row">
            {profile.role === "dietitian" && <button className="btn btn-primary" onClick={() => navigate("/clients")}>Clients & programmes</button>}
            <button className={profile.role === "dietitian" ? "btn btn-secondary" : "btn btn-primary"} onClick={() => navigate("/workbench")}>Open Workbench</button>
          </div>
        </Card>
      ) : isPro ? (
        cloud ? null : (
          <Card title="Verification">
            <p className="small">We're reviewing your details. The Workbench unlocks once you're verified.</p>
            {/* On-device mode only: there's no review backend without an account. */}
            <button className="btn btn-secondary" onClick={() => updateProfile({ verification: "verified" })}>
              Demo: approve my verification
            </button>
          </Card>
        )
      ) : (
        <Locked />
      )}

      {cloud && <AccountCard />}
      {cloud ? <CloudDeleteCard /> : (
      <Card title="Privacy & data">
        <p className="small">This version keeps your data on this device only. Nothing is sent to a server.</p>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (confirm("Delete all your Kalorax data on this device?")) {
              void resetAll().then(() => {
                clearInterventionsPreview();
                window.location.assign("/");
              });
            }
          }}
        >
          Delete my data
        </button>
      </Card>
      )}
      <Disclaimer />
      <p className="center"><Link to="/credits" className="link">Photo credits</Link></p>
    </div>
  );
}
