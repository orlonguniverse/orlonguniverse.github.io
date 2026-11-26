// ORLONG UNIVERSE — MAIN NAVIGATION ACCOUNT
(() => {
  const URL = "https://kqfwtzrfqsfampqfzoal.supabase.co";
  const KEY = "sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
  const client = window.supabase.createClient(URL, KEY);
  const button = document.getElementById("mainAccountButton");
  const dialog = document.getElementById("mainAccountDialog");
  const greeting = document.getElementById("mainAccountGreeting");
  if (!button || !dialog) return;

  let signedInUser = null;

  async function syncAccount(session) {
    signedInUser = session?.user || null;
    if (!signedInUser) {
      button.textContent = "MY ACCOUNT";
      greeting.textContent = "Sign in or create a free reader account to view your profile and reading statistics.";
      return;
    }
    let displayName = signedInUser.user_metadata?.display_name || "Reader";
    const { data } = await client.from("reader_profiles").select("display_name").eq("user_id", signedInUser.id).maybeSingle();
    if (data?.display_name) displayName = data.display_name;
    button.textContent = displayName.toUpperCase();
    greeting.textContent = "Signed in as " + displayName + ". Your reader account is free.";
  }

  button.addEventListener("click", () => {
    if (!signedInUser) {
      window.location.href = "books/trials-of-eden/account.html";
      return;
    }
    if (!dialog.open) dialog.showModal();
  });
  document.getElementById("closeMainAccount")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  document.getElementById("mainAccountSignOut")?.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) {
      greeting.textContent = "We couldn't sign you out. Please try again.";
      return;
    }
    dialog.close();
    await syncAccount(null);
  });

  client.auth.getSession().then(({ data }) => syncAccount(data.session));
  client.auth.onAuthStateChange((_event, session) => window.setTimeout(() => syncAccount(session), 0));
})();
