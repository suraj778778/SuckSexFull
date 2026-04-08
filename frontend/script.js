const screens = {
  landing: document.getElementById('landing-page'),
  setup: document.getElementById('setup-page'),
  modePage: document.getElementById('mode-page'),
  search: document.getElementById('search-page'),
  chat: document.getElementById('chat-page'),
  video: document.getElementById('video-page'),
};

function showScreen(name) {
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  screens[name].classList.add('active');
}

/* 👉 LANDING → SETUP */
document.getElementById('landing-continue').onclick = () => {
  showScreen('setup');
};

/* 👉 SETUP → SEARCH */
document.getElementById('setup-continue').onclick = () => {
  const name = document.getElementById('username').value;
  const mode = document.getElementById('mode').value;

  if (!name || !mode) {
    alert("Enter name and select option");
    return;
  }

  showScreen('search');

  setTimeout(() => {
    if (mode === "text") {
      showScreen('chat');
    } else {
      showScreen('video');
    }
  }, 2000);
};
