import { Database, KeyRound, OctagonX, ScanEye } from "lucide-react";

export const trustPoints = [
  {
    icon: KeyRound,
    title: "Account permissions",
    body: "Integrations use broker-issued authorization with the narrowest permissions available. We never request withdrawal access where a broker lets us avoid it, and we never ask for your broker password.",
  },
  {
    icon: Database,
    title: "Your data",
    body: "Credentials and tokens are encrypted and stay on our servers — they're never sent to your browser. We collect what's needed to run the service and don't sell personal data.",
  },
  {
    icon: ScanEye,
    title: "Automation you can see",
    body: "Every signal, order, and setting change is logged. Simulated and live activity are labeled differently everywhere, so you always know which is which.",
  },
  {
    icon: OctagonX,
    title: "Risk stays with limits",
    body: "Strategies — including AI drafts — must pass your position and loss limits before any order is sent. You can pause or stop automation at any time.",
  },
];

export function TrustGrid() {
  return (
    <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
      {trustPoints.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-card text-muted">
            <Icon size={18} aria-hidden />
          </span>
          <div>
            <h3 className="font-medium text-fg">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
