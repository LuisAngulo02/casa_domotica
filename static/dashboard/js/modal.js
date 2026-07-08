export function initModal(loadHistoryCallback) {
  const openModalBtn = document.querySelector("#openModal");
  const closeModalBtn = document.querySelector("#closeModal");
  const eventsModal = document.querySelector("#eventsModal");

  if (!eventsModal) return;

  const close = () => {
    eventsModal.classList.remove("is-active");
    eventsModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  if (openModalBtn) {
    openModalBtn.addEventListener("click", () => {
      if (typeof loadHistoryCallback === "function") {
        loadHistoryCallback();
      }
      eventsModal.classList.add("is-active");
      eventsModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", close);
  }

  eventsModal.addEventListener("click", (e) => {
    if (e.target === eventsModal) {
      close();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && eventsModal.classList.contains("is-active")) {
      close();
    }
  });
}

export function initSensorModal() {
  const openBtn = document.querySelector("#openSensorModal");
  const closeBtn = document.querySelector("#closeSensorModal");
  const modal = document.querySelector("#sensorModal");

  if (!modal) return;

  const close = () => {
    modal.classList.remove("is-active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  if (openBtn) {
    openBtn.addEventListener("click", () => {
      modal.classList.add("is-active");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", close);
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("modal-backdrop")) {
      close();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-active")) {
      close();
    }
  });
}

export function initVoiceHelpModal() {
  const openBtn = document.querySelector("#voiceHelpBtn");
  const closeBtn = document.querySelector("#closeVoiceHelpModal");
  const modal = document.querySelector("#voiceHelpModal");

  if (!modal) return;

  const close = () => {
    modal.classList.remove("is-active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  if (openBtn) {
    openBtn.addEventListener("click", () => {
      modal.classList.add("is-active");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", close);
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("modal-backdrop")) {
      close();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-active")) {
      close();
    }
  });
}
