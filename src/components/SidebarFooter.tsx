import { useState } from "react";
import { AccountModal } from "./AccountModal";
import { DonateModal } from "./DonateModal";
import "./SidebarFooter.css";

const REPO_URL = "https://github.com/pampeanodev/fixture";
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
const DONATION_LN_ADDRESS = "noisyfox5@primal.net";

export function SidebarFooter() {
  const [showAccount, setShowAccount] = useState(false);
  const [showDonate, setShowDonate] = useState(false);

  return (
    <>
      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-footer-account"
          onClick={() => setShowAccount(true)}
        >
          <span className="sidebar-footer-account-icon" aria-hidden="true">
            &#9881;
          </span>
          <span>Mi cuenta</span>
        </button>

        <button
          type="button"
          className="sidebar-footer-donate"
          onClick={() => setShowDonate(true)}
        >
          <span aria-hidden="true">⚡</span>
          <span>Donar</span>
        </button>

        <div className="sidebar-footer-meta">
          <a
            className="sidebar-footer-link"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Repositorio en GitHub"
          >
            <GithubIcon />
            <span>GitHub</span>
          </a>
          <span className="sidebar-footer-sep" aria-hidden="true">·</span>
          <a
            className="sidebar-footer-link"
            href={LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            GPL-3.0
          </a>
        </div>

        <div className="sidebar-footer-copy">
          © 2026 Pampeano Dev
        </div>
      </div>
      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
      {showDonate && (
        <DonateModal
          lightningAddress={DONATION_LN_ADDRESS}
          onClose={() => setShowDonate(false)}
        />
      )}
    </>
  );
}

function GithubIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 19 19"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.356 1.85C5.05 1.85 1.57 5.356 1.57 9.694a7.84 7.84 0 0 0 5.324 7.44c.387.079.528-.168.528-.376 0-.182-.013-.805-.013-1.454-2.165.467-2.616-.935-2.616-.935-.349-.91-.864-1.143-.864-1.143-.71-.48.051-.48.051-.48.787.051 1.2.805 1.2.805.695 1.194 1.817.857 2.268.649.064-.507.27-.857.49-1.052-1.728-.182-3.545-.857-3.545-3.87 0-.857.31-1.558.8-2.104-.078-.195-.349-1 .077-2.078 0 0 .657-.208 2.14.805a7.5 7.5 0 0 1 1.946-.26c.657 0 1.328.092 1.946.26 1.483-1.013 2.14-.805 2.14-.805.426 1.078.155 1.883.078 2.078.502.546.799 1.247.799 2.104 0 3.013-1.818 3.675-3.558 3.87.284.247.528.714.528 1.454 0 1.052-.012 1.896-.012 2.156 0 .208.142.455.528.377a7.84 7.84 0 0 0 5.324-7.441c.013-4.338-3.48-7.844-7.773-7.844"
      />
    </svg>
  );
}
