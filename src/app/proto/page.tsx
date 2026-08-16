import Link from "next/link";

import { SCREENS, type Screen } from "./screens";

export default function ProtoIndex() {
  const groups = SCREENS.reduce<Record<string, Screen[]>>((acc, screen) => {
    (acc[screen.group] ??= []).push(screen);
    return acc;
  }, {});

  return (
    <div className="px-5 py-8">
      <h1 className="display text-[28px]">Screens</h1>
      <p className="mt-2 text-[14px] text-ash">
        {SCREENS.length} routes. Nothing here talks to a server.
      </p>

      <div className="mt-8 space-y-7">
        {Object.entries(groups).map(([group, screens]) => (
          <section key={group}>
            <h2 className="marking">{group}</h2>
            <ul className="mt-2 divide-y divide-hair">
              {screens.map((screen) => (
                <li key={screen.path}>
                  <Link
                    href={screen.path}
                    className="flex items-center justify-between gap-4 py-3 text-[15px] text-chalk transition-colors hover:text-flame"
                  >
                    {screen.name}
                    <span className="text-[12px] text-dust" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
