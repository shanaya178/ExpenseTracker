/* Shared Firebase app, Google sign-in gate, and Firestore helpers.
   The config matches the existing Firebase Google login page. */
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyCectC2gNXIYpL8Rt4QeOsQuW5oEF2Tf4k",
    authDomain: "techcoderlabz-project.firebaseapp.com",
    projectId: "techcoderlabz-project",
    storageBucket: "techcoderlabz-project.firebasestorage.app",
    messagingSenderId: "750937809509",
    appId: "1:750937809509:web:b3561297b5d8ea282b5c8c",
    measurementId: "G-J13K9JQ058",
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  let activeUid = null;
  let deliveredUid = null;
  let delivering = false;
  let readyHandler = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function errorMessage(error) {
    const code = error && error.code ? error.code : "";

    if (code === "permission-denied") {
      return "Firestore refused this request. Publish the rules in firestore.rules so each signed-in user can read and write only their own data.";
    }

    if (code === "auth/unauthorized-domain") {
      return "This site is not an authorized domain for the Firebase project. Add it under Authentication → Settings → Authorized domains.";
    }

    if (code === "auth/popup-closed-by-user") {
      return "The Google sign-in window was closed before it finished.";
    }

    if (code === "auth/popup-blocked") {
      return "The browser blocked the Google sign-in window. Allow popups, or use the redirect sign-in that follows.";
    }

    if (code === "auth/network-request-failed") {
      return "The network request to Firebase failed. Check the connection and try again.";
    }

    if (error && error.message) {
      return error.message;
    }

    return "Something went wrong. Try again.";
  }

  function setAuthError(message) {
    const el = document.getElementById("auth-error");
    if (el) {
      el.textContent = message || "";
    }
  }

  function setAuthStatus(message, showButton) {
    const status = document.getElementById("auth-status");
    const button = document.getElementById("google-sign-in");

    if (status) {
      status.textContent = message;
    }

    if (button) {
      button.hidden = !showButton;
      button.disabled = false;
    }
  }

  function setLoading(isLoading) {
    let loading = document.getElementById("data-loading");

    if (!loading) {
      loading = document.createElement("div");
      loading.id = "data-loading";
      loading.setAttribute("role", "status");
      loading.textContent = "Loading your data…";
      document.body.appendChild(loading);
    }

    loading.hidden = !isLoading;
  }

  function showBanner(message) {
    let banner = document.getElementById("app-banner");

    if (!banner) {
      banner = document.createElement("div");
      banner.id = "app-banner";
      banner.setAttribute("role", "alert");
      document.body.appendChild(banner);
    }

    banner.textContent = message;
    banner.hidden = !message;
  }

  function collection(name) {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Sign in with Google before saving data.");
    }

    return db.collection("users").doc(user.uid).collection(name);
  }

  function sanitize(data) {
    const clean = {};

    Object.keys(data || {}).forEach(function (key) {
      if (key === "id" || key === "createdAt") {
        return;
      }

      const value = data[key];

      if (value !== undefined) {
        clean[key] = value;
      }
    });

    return clean;
  }

  async function load(name) {
    const snapshot = await collection(name).orderBy("createdAt", "asc").get();

    return snapshot.docs.map(function (doc) {
      const data = doc.data();
      delete data.createdAt;
      return Object.assign({ id: doc.id }, data);
    });
  }

  async function add(name, data) {
    const payload = sanitize(data);
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    const ref = await collection(name).add(payload);
    return ref.id;
  }

  async function update(name, id, data) {
    await collection(name).doc(id).set(sanitize(data), { merge: true });
  }

  async function remove(name, id) {
    await collection(name).doc(id).delete();
  }

  async function migrateLocalList(storageKey, collectionName) {
    let raw = null;

    try {
      raw = localStorage.getItem(storageKey);
    } catch (error) {
      return;
    }

    if (!raw) {
      return;
    }

    let items = [];

    try {
      items = JSON.parse(raw);
    } catch (error) {
      localStorage.removeItem(storageKey);
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      localStorage.removeItem(storageKey);
      return;
    }

    const existing = await collection(collectionName).limit(1).get();

    if (existing.empty) {
      const chunkSize = 400;

      for (let index = 0; index < items.length; index += chunkSize) {
        const batch = db.batch();

        items.slice(index, index + chunkSize).forEach(function (item) {
          const ref = collection(collectionName).doc();
          const payload = sanitize(item);
          payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          batch.set(ref, payload);
        });

        await batch.commit();
      }
    }

    localStorage.removeItem(storageKey);
  }

  function renderUserBar(user) {
    let bar = document.getElementById("user-bar");

    if (!bar) {
      bar = document.createElement("header");
      bar.id = "user-bar";
      bar.innerHTML =
        '<a class="brand" href="index.html">My Dashboard</a>' +
        '<div class="user-meta">' +
        '<img id="user-avatar" alt="" width="32" height="32">' +
        '<span id="user-label"></span>' +
        '<button id="sign-out" type="button">Sign out</button>' +
        "</div>";
      document.body.prepend(bar);
      document.getElementById("sign-out").addEventListener("click", function () {
        auth.signOut();
      });
    }

    const avatar = document.getElementById("user-avatar");
    const label = document.getElementById("user-label");
    const name = user.displayName || "Signed in";
    const email = user.email || "";

    label.textContent = email ? name + " · " + email : name;
    avatar.alt = "";

    if (user.photoURL) {
      avatar.src = user.photoURL;
      avatar.hidden = false;
    } else {
      avatar.removeAttribute("src");
      avatar.hidden = true;
    }
  }

  async function signIn() {
    const button = document.getElementById("google-sign-in");
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    setAuthError("");

    if (button) {
      button.disabled = true;
    }

    setAuthStatus("Opening Google sign-in…", true);

    try {
      await auth.signInWithPopup(provider);
    } catch (error) {
      const code = error && error.code;

      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment" ||
        code === "auth/cancelled-popup-request"
      ) {
        try {
          await auth.signInWithRedirect(provider);
          return;
        } catch (redirectError) {
          setAuthStatus("Sign in with Google to use this page.", true);
          setAuthError(errorMessage(redirectError));
          return;
        }
      }

      setAuthStatus("Sign in with Google to use this page.", true);
      setAuthError(errorMessage(error));
    }
  }

  async function deliver(user) {
    if (!readyHandler || delivering || deliveredUid === user.uid) {
      return;
    }

    delivering = true;
    setLoading(true);

    try {
      await readyHandler(user);
      deliveredUid = user.uid;
    } catch (error) {
      console.error(error);
      showBanner(errorMessage(error));
    } finally {
      delivering = false;
      setLoading(false);
    }
  }

  function handleUser(user) {
    showBanner("");

    if (!user) {
      activeUid = null;
      deliveredUid = null;
      document.body.classList.remove("signed-in");
      setAuthStatus("Sign in with Google to use this page.", true);
      return;
    }

    activeUid = user.uid;
    renderUserBar(user);
    document.body.classList.add("signed-in");
    deliver(user);
  }

  const button = document.getElementById("google-sign-in");

  if (button) {
    button.addEventListener("click", signIn);
  }

  auth
    .getRedirectResult()
    .catch(function (error) {
      if (error && error.code && error.code !== "auth/no-auth-event") {
        setAuthError(errorMessage(error));
      }
    });

  auth.onAuthStateChanged(function (user) {
    handleUser(user);
  });

  window.Tracker = {
    escape: escapeHtml,
    errorMessage: errorMessage,
    showBanner: showBanner,
    load: load,
    add: add,
    update: update,
    remove: remove,
    migrateLocalList: migrateLocalList,
    onReady: function (handler) {
      readyHandler = handler;

      if (auth.currentUser) {
        handleUser(auth.currentUser);
      }
    },
  };
})();
