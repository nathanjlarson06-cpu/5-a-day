/* Five a Day backend: connects the game to Supabase.
   The game was first built for claude.ai, which gave it three helpers: user, db and downloads.
   This file provides the same three helpers on top of Supabase, so the game code barely changes.
   Exposes:  window.claude.use(name)  and  window.FIVE_AUTH (sign in / sign out / display name). */
(() => {
  "use strict";
  const cfg = window.FIVE_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && !/YOUR_/.test(cfg.supabaseUrl + cfg.supabaseAnonKey));
  const sb = configured && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } })
    : null;
  if (!configured) console.warn("Five a Day: Supabase isn't set up yet. Fill in config.js. The game still works offline.");

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let session = null, profile = null, isAdmin = false;

  const ready = (async () => {
    if (!sb) return;
    try {
      const { data } = await sb.auth.getSession();
      session = data.session || null;
      if (session) {
        const uid = session.user.id;
        const [p, a] = await Promise.all([
          sb.from("profiles").select("id,name,avatar_url").eq("id", uid).maybeSingle(),
          sb.from("admins").select("user_id").eq("user_id", uid).maybeSingle()
        ]);
        profile = p.data || null;
        isAdmin = !!a.data;
      }
    } catch (e) { console.warn("Five a Day: sign-in check failed", e); }
    // Reload once when someone signs in or out in another tab, so the game picks it up.
    sb.auth.onAuthStateChange((evt, s) => {
      const was = session?.user?.id || null, now = s?.user?.id || null;
      session = s || null;
      if (was !== now && (evt === "SIGNED_IN" || evt === "SIGNED_OUT")) location.reload();
    });
  })();

  /* ---------- user ---------- */
  const user = {
    id: async () => session?.user?.id || null,
    canEdit: async () => isAdmin,
    async profiles(ids) {
      const out = {};
      ids = [...new Set(ids)].filter(id => UUID.test(id));
      if (!sb || !ids.length) return out;
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await sb.from("profiles").select("id,name,avatar_url").in("id", ids.slice(i, i + 100));
        for (const r of data || []) out[r.id] = { name: r.name, avatarUrl: r.avatar_url || undefined };
      }
      return out;
    }
  };

  /* ---------- db: collections and documents with live updates ---------- */
  const snapOf = rows => ({ docs: rows.map(r => ({ id: r.id, data: () => r.data })), metadata: { fromCache: false } });
  function live(collection, onChange) {
    // Realtime push, plus a slow poll as a safety net if the live connection drops.
    let t = 0;
    const kick = () => { clearTimeout(t); t = setTimeout(onChange, 350); };
    const ch = sb.channel("docs-" + collection + "-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "collection=eq." + collection }, kick)
      .subscribe();
    const poll = setInterval(onChange, 60000);
    const vis = () => { if (!document.hidden) onChange(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearTimeout(t); clearInterval(poll); document.removeEventListener("visibilitychange", vis); sb.removeChannel(ch); };
  }
  function collection(name, max = 1000) {
    return {
      limit: n => collection(name, n),
      onSnapshot(cb, err) {
        let stopped = false;
        const load = async () => {
          if (stopped) return;
          const { data, error } = await sb.from("docs").select("id,data").eq("collection", name).limit(max);
          if (stopped) return;
          if (error) { err && err(error); return; }
          cb(snapOf(data || []));
        };
        load();
        const stop = live(name, load);
        return () => { stopped = true; stop(); };
      }
    };
  }
  function doc(path) {
    const i = path.indexOf("/"), col = path.slice(0, i), id = path.slice(i + 1);
    return {
      async set(data) {
        const { error } = await sb.from("docs").upsert({ collection: col, id, data, updated_at: new Date().toISOString() });
        if (error) throw error;
      },
      onSnapshot(cb, err) {
        let stopped = false;
        const load = async () => {
          if (stopped) return;
          const { data, error } = await sb.from("docs").select("id,data").eq("collection", col).eq("id", id).maybeSingle();
          if (stopped) return;
          if (error) { err && err(error); return; }
          cb({ id, exists: !!data, data: () => data?.data });
        };
        load();
        const stop = live(col, load);
        return () => { stopped = true; stop(); };
      }
    };
  }
  const db = { collection: name => collection(name), doc };

  /* ---------- downloads: save a file to the player's device ---------- */
  const downloads = {
    async save({ filename, data }) {
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
      const a = document.createElement("a");
      a.href = url; a.download = filename || "five-a-day.png";
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  };

  window.claude = {
    async use(name) {
      await ready;
      if (!sb) throw new Error("offline");
      if (name === "user") return user;
      if (name === "db") return db;
      if (name === "downloads") return downloads;
      throw new Error("unknown helper " + name);
    }
  };

  /* ---------- sign in / sign out / display name, used by the page ---------- */
  window.FIVE_AUTH = {
    ready,
    get configured() { return !!sb; },
    get signedIn() { return !!session; },
    get email() { return session?.user?.email || ""; },
    get name() { return profile?.name || ""; },
    get needsName() { return !!session && !profile; },
    get googleEnabled() { return !!cfg.googleSignIn; },
    async emailLink(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
    },
    async google() {
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
      if (error) throw error;
    },
    async signOut() { await sb.auth.signOut(); location.reload(); },
    async setName(name) {
      name = String(name || "").trim().replace(/\s+/g, " ").slice(0, 24);
      if (name.length < 2) throw new Error("Use at least 2 characters.");
      const { data, error } = await sb.from("profiles").upsert({ id: session.user.id, name }).select("id,name,avatar_url").single();
      if (error) throw error;
      profile = data;
      return name;
    }
  };
})();
