import { getCurrentUser } from "@/lib/session";

import { JoinScreen } from "./JoinScreen";

export const metadata = { title: "Join a roll" };
export const dynamic = "force-dynamic";

export default async function JoinARoll() {
  /*
    Back goes wherever the person came from, which depends on who they are.
    
    Hardcoded to /welcome, a signed-in host who tapped Join on their home screen and then
    pressed back landed on a page offering "Continue with Google" and reasonably concluded
    they had been signed out.
  */
  const user = await getCurrentUser();
  return <JoinScreen back={user ? "/rolls" : "/welcome"} />;
}
