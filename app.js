// Bhagavad Gita Chapter 12 Web Application Engine
// High-precision synchronized recitation highlighting with colored overlay for chanted words
// Debugged with individual shloka audio splitting, zero-latency playback, and mobile touch support

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("shlokas-container");
  const jumpList = document.getElementById("jump-list");
  const searchInput = document.getElementById("search-input");
  const themeSelect = document.getElementById("theme-select");
  const autoAdvanceBtn = document.getElementById("btn-auto-advance");
  const playAllBtn = document.getElementById("btn-play-all");
  const activeAudioTrackGlobal = document.getElementById("global-track-select");

  // State
  let currentAudio = null;
  let currentShlokaNum = null;
  let currentTrackType = "sanskrit"; // 'sanskrit', 'recit', 'full'
  let animFrameId = null;
  let autoAdvance = false;
  let globalVolume = 0.9;

  // Initialize
  initApp();

  function initApp() {
    renderJumpList();
    renderShlokas();
    bindGlobalEvents();
  }

  // 1. Render Navigation Jump Pills (1-20)
  function renderJumpList() {
    jumpList.innerHTML = "";
    GITA_DATA.forEach(shloka => {
      const pill = document.createElement("a");
      pill.href = `#shloka-${shloka.num}`;
      pill.className = "jump-pill";
      pill.id = `pill-${shloka.num}`;
      pill.textContent = shloka.num;
      pill.title = `श्लोक १२.${shloka.num}`;
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        const card = document.getElementById(`shloka-${shloka.num}`);
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          playShloka(shloka.num);
        }
      });
      jumpList.appendChild(pill);
    });
  }

  // 2. Render all Shloka Cards
  function renderShlokas() {
    container.innerHTML = "";
    GITA_DATA.forEach(shloka => {
      const card = createShlokaCard(shloka);
      container.appendChild(card);
    });
  }

  function createShlokaCard(shloka) {
    const card = document.createElement("article");
    card.className = "shloka-card";
    card.id = `shloka-${shloka.num}`;
    card.dataset.num = shloka.num;
    card.dataset.activeTrack = currentTrackType;

    // Header Row
    const header = document.createElement("div");
    header.className = "shloka-card-header";
    header.innerHTML = `
      <div class="shloka-badge-group">
        <span class="shloka-number-badge">श्लोक १२.${shloka.num}</span>
        ${shloka.speaker ? `<span class="speaker-badge" id="speaker-badge-${shloka.num}">${shloka.speaker}</span>` : ""}
      </div>
      <div class="shloka-card-actions">
        <button class="action-icon-btn" onclick="copyShlokaText(${shloka.num})" title="Copy Sanskrit text">📋 Copy</button>
      </div>
    `;
    card.appendChild(header);

    // Content Body
    const content = document.createElement("div");
    content.className = "shloka-content";

    // Sanskrit Recitation Box (With Colored Overlay on Recited Words)
    const recitationBox = document.createElement("div");
    recitationBox.className = "shloka-recitation-box";
    recitationBox.id = `recite-box-${shloka.num}`;

    shloka.sanskrit.forEach((lineText, lineIdx) => {
      const lineDiv = document.createElement("div");
      lineDiv.className = "sanskrit-line";
      lineDiv.id = `line-${shloka.num}-${lineIdx}`;
      lineDiv.dataset.lineIdx = lineIdx;

      let lineCharWeight = 0;
      const words = lineText.trim().split(/\s+/);
      words.forEach((wordText, wordIdx) => {
        const wordSpan = document.createElement("span");
        wordSpan.className = "shlok-word";
        wordSpan.textContent = wordText;
        wordSpan.dataset.lineIdx = lineIdx;
        wordSpan.dataset.wordIdx = wordIdx;

        const cleanWord = wordText.replace(/[।॥\d\s]/g, "");
        const weight = Math.max(cleanWord.length, 1);
        wordSpan.dataset.startInLine = lineCharWeight;
        wordSpan.dataset.charWeight = weight;

        lineCharWeight += weight;

        // Clicking on a word jumps audio directly to that exact syllable in the audio
        wordSpan.addEventListener("click", (e) => {
          e.stopPropagation();
          const totalLineChars = parseFloat(lineDiv.dataset.totalLineChars) || 1;
          seekShlokaToWord(shloka.num, lineIdx, parseFloat(wordSpan.dataset.startInLine), totalLineChars);
        });

        lineDiv.appendChild(wordSpan);
      });

      lineDiv.dataset.totalLineChars = lineCharWeight;
      recitationBox.appendChild(lineDiv);
    });

    // Clicking anywhere on the recitation box toggles play/pause
    recitationBox.addEventListener("click", () => {
      togglePlay(shloka.num);
    });

    content.appendChild(recitationBox);

    // Audio Player Section Beneath Shloka
    const playerBox = document.createElement("div");
    playerBox.className = "audio-player-box";
    playerBox.id = `player-box-${shloka.num}`;

    // Hidden audio element
    const audio = document.createElement("audio");
    audio.id = `audio-${shloka.num}`;
    audio.preload = "metadata";
    audio.src = getAudioSrc(shloka, currentTrackType);
    playerBox.appendChild(audio);

    // Top Controls Row
    const topRow = document.createElement("div");
    topRow.className = "player-top-row";
    topRow.innerHTML = `
      <div class="player-main-controls">
        <button class="btn-play" id="btn-play-${shloka.num}" title="Play / Pause">
          ▶
        </button>
        <div class="track-source-selector">
          <button class="source-btn ${currentTrackType === 'sanskrit' ? 'active' : ''}" data-track="sanskrit" title="Traditional Sanskrit Chanting (from Music folder)">🎵 Chanting</button>
          <button class="source-btn ${currentTrackType === 'recit' ? 'active' : ''}" data-track="recit" title="Clear Vedic Recitation">🎙️ Recitation</button>
          <button class="source-btn ${currentTrackType === 'full' ? 'active' : ''}" data-track="full" title="Complete Shloka + Narration (from Music folder)">📖 Full Audio</button>
        </div>
      </div>

      <div class="player-extra-controls">
        <button class="btn-mini btn-speed" id="btn-speed-${shloka.num}" title="Playback Speed">1.0x</button>
        <button class="btn-mini btn-loop" id="btn-loop-${shloka.num}" title="Loop Shloka">🔁</button>
        <div class="volume-control-group">
          <span style="font-size: 0.8rem; color: var(--unrecited-color)">🔊</span>
          <input type="range" class="volume-slider" min="0" max="1" step="0.05" value="${globalVolume}" id="vol-${shloka.num}" title="Volume">
        </div>
        <a class="btn-mini btn-download" id="btn-dl-${shloka.num}" href="${audio.src}" download="Gita_Ch12_Shloka_${String(shloka.num).padStart(2, '0')}.mp3" title="Download Audio">⬇️</a>
      </div>
    `;
    playerBox.appendChild(topRow);

    // Waveform / Scrubber Progress Row
    const scrubRow = document.createElement("div");
    scrubRow.className = "scrubber-container";
    scrubRow.innerHTML = `
      <span class="time-display current" id="cur-time-${shloka.num}">0:00</span>
      <div class="scrubber-track" id="scrub-track-${shloka.num}">
        <div class="scrubber-fill" id="scrub-fill-${shloka.num}"></div>
        <div class="scrubber-hover-time" id="scrub-hover-${shloka.num}">0:00</div>
      </div>
      <span class="time-display total" id="tot-time-${shloka.num}">0:00</span>
    `;
    playerBox.appendChild(scrubRow);

    content.appendChild(playerBox);
    card.appendChild(content);

    // Bind Player Events
    bindPlayerEvents(shloka, card, audio);

    return card;
  }

  function getAudioSrc(shloka, trackType) {
    if (trackType === "full") return shloka.audio.full;
    if (trackType === "recit") return shloka.audio.recit;
    return shloka.audio.sanskrit;
  }

  // 3. Audio & Colored Overlay Synchronization
  function bindPlayerEvents(shloka, card, audio) {
    const playBtn = card.querySelector(`#btn-play-${shloka.num}`);
    const trackButtons = card.querySelectorAll(".source-btn");
    const speedBtn = card.querySelector(`#btn-speed-${shloka.num}`);
    const loopBtn = card.querySelector(`#btn-loop-${shloka.num}`);
    const volSlider = card.querySelector(`#vol-${shloka.num}`);
    const dlBtn = card.querySelector(`#btn-dl-${shloka.num}`);
    const scrubTrack = card.querySelector(`#scrub-track-${shloka.num}`);
    const scrubFill = card.querySelector(`#scrub-fill-${shloka.num}`);
    const scrubHover = card.querySelector(`#scrub-hover-${shloka.num}`);
    const curTimeSpan = card.querySelector(`#cur-time-${shloka.num}`);
    const totTimeSpan = card.querySelector(`#tot-time-${shloka.num}`);
    const recitationBox = card.querySelector(`#recite-box-${shloka.num}`);

    // Track metadata
    audio.addEventListener("loadedmetadata", () => {
      totTimeSpan.textContent = formatTime(audio.duration);
    });

    // Play / Pause Toggle
    playBtn.addEventListener("click", () => {
      togglePlay(shloka.num);
    });

    // Track Source Switcher
    trackButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        trackButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const track = btn.dataset.track;
        card.dataset.activeTrack = track;
        const wasPlaying = !audio.paused;
        audio.src = getAudioSrc(shloka, track);
        dlBtn.href = audio.src;
        audio.load();
        if (wasPlaying) {
          audio.play().catch(() => {});
        }
      });
    });

    // Speed button
    const speeds = [0.75, 1.0, 1.25, 1.5];
    let curSpeedIdx = 1;
    speedBtn.addEventListener("click", () => {
      curSpeedIdx = (curSpeedIdx + 1) % speeds.length;
      const spd = speeds[curSpeedIdx];
      audio.playbackRate = spd;
      speedBtn.textContent = `${spd}x`;
      speedBtn.classList.toggle("active", spd !== 1.0);
    });

    // Loop button
    loopBtn.addEventListener("click", () => {
      audio.loop = !audio.loop;
      loopBtn.classList.toggle("active", audio.loop);
    });

    // Volume Slider with cross-card sync
    volSlider.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      audio.volume = v;
      globalVolume = v;
      document.querySelectorAll(".volume-slider").forEach(sl => {
        sl.value = v;
      });
    });

    // Scrubber click & drag handler (Supports Mouse and Touch)
    function handleScrub(e) {
      const rect = scrubTrack.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (audio.duration) {
        audio.currentTime = pos * audio.duration;
        updateHighPrecisionOverlay(shloka, card, audio.currentTime);
      }
    }

    scrubTrack.addEventListener("click", handleScrub);

    // Touch dragging on mobile
    let isTouchDragging = false;
    scrubTrack.addEventListener("touchstart", (e) => {
      isTouchDragging = true;
      handleScrub(e);
    }, { passive: true });

    scrubTrack.addEventListener("touchmove", (e) => {
      if (isTouchDragging) {
        handleScrub(e);
      }
    }, { passive: true });

    scrubTrack.addEventListener("touchend", () => {
      isTouchDragging = false;
    });

    // Hover tooltip for desktop
    scrubTrack.addEventListener("mousemove", (e) => {
      const rect = scrubTrack.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (audio.duration) {
        scrubHover.style.display = "block";
        scrubHover.style.left = `${pos * 100}%`;
        scrubHover.textContent = formatTime(pos * audio.duration);
      }
    });

    scrubTrack.addEventListener("mouseleave", () => {
      scrubHover.style.display = "none";
    });

    // Audio Play Event
    audio.addEventListener("play", () => {
      if (currentAudio && currentAudio !== audio) {
        currentAudio.pause();
      }
      currentAudio = audio;
      currentShlokaNum = shloka.num;

      // Update UI states
      playBtn.textContent = "⏸";
      playBtn.classList.add("playing");
      card.classList.add("playing");
      recitationBox.classList.add("active");
      document.getElementById(`pill-${shloka.num}`)?.classList.add("playing");

      updateGlobalBanner(shloka);
      startHighPrecisionOverlay(shloka, card);
    });

    // Audio Pause Event
    audio.addEventListener("pause", () => {
      playBtn.textContent = "▶";
      playBtn.classList.remove("playing");
      card.classList.remove("playing");
      recitationBox.classList.remove("active");
      document.getElementById(`pill-${shloka.num}`)?.classList.remove("playing");

      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
      clearCurrentHighlight(shloka.num);
    });

    // Audio End Event
    audio.addEventListener("ended", () => {
      playBtn.textContent = "▶";
      playBtn.classList.remove("playing");
      card.classList.remove("playing");
      recitationBox.classList.remove("active");
      document.getElementById(`pill-${shloka.num}`)?.classList.remove("playing");
      clearCurrentHighlight(shloka.num);

      if (autoAdvance && shloka.num < 20) {
        const nextNum = shloka.num + 1;
        const nextCard = document.getElementById(`shloka-${nextNum}`);
        if (nextCard) {
          nextCard.scrollIntoView({ behavior: "smooth", block: "center" });
          playShloka(nextNum);
        }
      }
    });

    // Audio Time Update for Scrubber & Timer
    audio.addEventListener("timeupdate", () => {
      if (audio.duration) {
        const ratio = audio.currentTime / audio.duration;
        scrubFill.style.width = `${ratio * 100}%`;
        curTimeSpan.textContent = formatTime(audio.currentTime);
      }
    });
  }

  // 4. High-Precision Recitation Synchronization Engine
  function startHighPrecisionOverlay(shloka, card) {
    function step() {
      if (!currentAudio || currentAudio.paused || currentShlokaNum !== shloka.num) return;

      updateHighPrecisionOverlay(shloka, card, currentAudio.currentTime);
      animFrameId = requestAnimationFrame(step);
    }
    animFrameId = requestAnimationFrame(step);
  }

  function updateHighPrecisionOverlay(shloka, card, currentTime) {
    const box = document.getElementById(`recite-box-${shloka.num}`);
    if (!box) return;

    // Use card's active track preference
    const activeTrack = card.dataset.activeTrack || currentTrackType || "sanskrit";
    const timingMap = shloka.timing || {};
    const trackTiming = timingMap[activeTrack] || timingMap.sanskrit || {
      line1: [0.05, (currentAudio?.duration || 10) * 0.48],
      line2: [(currentAudio?.duration || 10) * 0.52, (currentAudio?.duration || 10) * 0.95]
    };

    const spkBadge = document.getElementById(`speaker-badge-${shloka.num}`);

    // A. Check Speaker Announcement (e.g. "अर्जुन उवाच", "श्रीभगवानुवाच")
    if (trackTiming.speaker && spkBadge) {
      if (currentTime >= trackTiming.speaker[0] && currentTime <= trackTiming.speaker[1]) {
        spkBadge.style.boxShadow = "0 0 16px var(--main-glow)";
        spkBadge.style.transform = "scale(1.08)";
        spkBadge.style.backgroundColor = "var(--main-color)";
        spkBadge.style.color = "#1e1e1e";
      } else {
        spkBadge.style.boxShadow = "";
        spkBadge.style.transform = "";
        spkBadge.style.backgroundColor = "";
        spkBadge.style.color = "";
      }
    }

    const line1Box = document.getElementById(`line-${shloka.num}-0`);
    const line2Box = document.getElementById(`line-${shloka.num}-1`);
    if (!line1Box || !line2Box) return;

    const [l1Start, l1End] = trackTiming.line1;
    const [l2Start, l2End] = trackTiming.line2;

    // Case 1: Before Line 1 starts
    if (currentTime < l1Start) {
      clearAllLineHighlights(line1Box);
      clearAllLineHighlights(line2Box);
      return;
    }

    // Case 2: During Line 1 recitation
    if (currentTime >= l1Start && currentTime <= l1End) {
      const lineProg = (currentTime - l1Start) / (l1End - l1Start);
      highlightLineWords(line1Box, lineProg);
      clearAllLineHighlights(line2Box);
      return;
    }

    // Case 3: In between Line 1 and Line 2 (half-verse breath pause)
    if (currentTime > l1End && currentTime < l2Start) {
      markLineAsRecited(line1Box);
      clearAllLineHighlights(line2Box);
      return;
    }

    // Case 4: During Line 2 recitation
    if (currentTime >= l2Start && currentTime <= l2End) {
      markLineAsRecited(line1Box);
      const lineProg = (currentTime - l2Start) / (l2End - l2Start);
      highlightLineWords(line2Box, lineProg);
      return;
    }

    // Case 5: After Line 2 ends (chanting completed)
    if (currentTime > l2End) {
      markLineAsRecited(line1Box);
      markLineAsRecited(line2Box);
    }
  }

  function highlightLineWords(lineElement, lineProg) {
    const totalChars = parseFloat(lineElement.dataset.totalLineChars) || 1;
    const currentProgChars = Math.min(totalChars, lineProg * totalChars);

    const words = lineElement.querySelectorAll(".shlok-word");
    let foundActive = false;

    words.forEach(w => {
      const start = parseFloat(w.dataset.startInLine);
      const weight = parseFloat(w.dataset.charWeight);
      const end = start + weight;

      if (currentProgChars >= start && currentProgChars < end && !foundActive) {
        w.className = "shlok-word current-reciting";
        foundActive = true;
      } else if (currentProgChars >= end) {
        w.className = "shlok-word recited";
      } else {
        w.className = "shlok-word";
      }
    });

    if (lineProg >= 0.96) {
      words.forEach(w => {
        w.className = "shlok-word recited";
      });
    }
  }

  function markLineAsRecited(lineElement) {
    const words = lineElement.querySelectorAll(".shlok-word");
    words.forEach(w => {
      w.className = "shlok-word recited";
    });
  }

  function clearAllLineHighlights(lineElement) {
    const words = lineElement.querySelectorAll(".shlok-word");
    words.forEach(w => {
      w.className = "shlok-word";
    });
  }

  function clearCurrentHighlight(shlokaNum) {
    const box = document.getElementById(`recite-box-${shlokaNum}`);
    if (!box) return;
    const activeWords = box.querySelectorAll(".shlok-word.current-reciting");
    activeWords.forEach(w => {
      w.classList.remove("current-reciting");
      w.classList.add("recited");
    });
  }

  // Seek Shloka audio directly to clicked word
  function seekShlokaToWord(verseNum, lineIdx, wordStartInLine, totalLineChars) {
    const shloka = GITA_DATA.find(s => s.num === verseNum);
    const card = document.getElementById(`shloka-${verseNum}`);
    const audio = card?.querySelector("audio");
    if (!shloka || !audio) return;

    const activeTrack = card.dataset.activeTrack || currentTrackType || "sanskrit";
    const timingMap = shloka.timing || {};
    const trackTiming = timingMap[activeTrack] || timingMap.sanskrit;
    if (!trackTiming) return;

    const [lineStart, lineEnd] = lineIdx === 0 ? trackTiming.line1 : trackTiming.line2;
    const ratioInLine = Math.max(0, Math.min(1, wordStartInLine / (totalLineChars || 1)));
    const targetAudioTime = lineStart + ratioInLine * (lineEnd - lineStart);

    audio.currentTime = targetAudioTime;
    updateHighPrecisionOverlay(shloka, card, targetAudioTime);
    if (audio.paused) {
      audio.play().catch(() => {});
    }
  }

  // 5. Playback Helper Functions
  function togglePlay(verseNum) {
    const card = document.getElementById(`shloka-${verseNum}`);
    const audio = card?.querySelector("audio");
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function playShloka(verseNum) {
    const card = document.getElementById(`shloka-${verseNum}`);
    const audio = card?.querySelector("audio");
    if (audio) {
      audio.play().catch(() => {});
    }
  }

  // 6. Global Banner Update
  function updateGlobalBanner(shloka) {
    const banner = document.getElementById("global-player-banner");
    const title = document.getElementById("global-now-playing-title");
    if (banner && title) {
      banner.style.display = "block";
      title.textContent = `श्लोक १२.${shloka.num} ${shloka.speaker ? '— ' + shloka.speaker : ''}`;
    }
  }

  // 7. Global Event Bindings
  function bindGlobalEvents() {
    // Theme Selector
    themeSelect.addEventListener("change", (e) => {
      document.body.setAttribute("data-theme", e.target.value);
    });

    // Auto-advance toggle
    autoAdvanceBtn.addEventListener("click", () => {
      autoAdvance = !autoAdvance;
      autoAdvanceBtn.classList.toggle("active", autoAdvance);
      autoAdvanceBtn.textContent = autoAdvance ? "⏩ Auto-Advance: ON" : "⏩ Auto-Advance: OFF";
    });

    // Global Play All
    playAllBtn.addEventListener("click", () => {
      const firstCard = document.getElementById("shloka-1");
      if (firstCard) {
        firstCard.scrollIntoView({ behavior: "smooth", block: "center" });
        playShloka(1);
      }
    });

    // Global Track Preference Switcher
    activeAudioTrackGlobal.addEventListener("change", (e) => {
      currentTrackType = e.target.value;
      GITA_DATA.forEach(shloka => {
        const card = document.getElementById(`shloka-${shloka.num}`);
        const audio = card?.querySelector("audio");
        const trackButtons = card?.querySelectorAll(".source-btn");
        const dlBtn = card?.querySelector(`#btn-dl-${shloka.num}`);
        if (card) {
          card.dataset.activeTrack = currentTrackType;
        }
        if (audio && trackButtons) {
          const wasPlaying = !audio.paused;
          audio.src = getAudioSrc(shloka, currentTrackType);
          if (dlBtn) dlBtn.href = audio.src;
          trackButtons.forEach(b => {
            b.classList.toggle("active", b.dataset.track === currentTrackType);
          });
          if (wasPlaying) {
            audio.play().catch(() => {});
          }
        }
      });
    });

    // Search Filter
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      GITA_DATA.forEach(shloka => {
        const card = document.getElementById(`shloka-${shloka.num}`);
        if (!card) return;

        const numMatch = String(shloka.num) === q || `12.${shloka.num}` === q;
        const sanskMatch = shloka.sanskrit.join(" ").toLowerCase().includes(q);

        if (!q || numMatch || sanskMatch) {
          card.style.display = "block";
        } else {
          card.style.display = "none";
        }
      });
    });

    // Global Keyboard Controls
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        if (currentShlokaNum) {
          togglePlay(currentShlokaNum);
        } else {
          playShloka(1);
        }
      } else if (e.code === "ArrowLeft" && currentAudio) {
        e.preventDefault();
        currentAudio.currentTime = Math.max(0, currentAudio.currentTime - 5);
      } else if (e.code === "ArrowRight" && currentAudio) {
        e.preventDefault();
        currentAudio.currentTime = Math.min(currentAudio.duration, currentAudio.currentTime + 5);
      } else if (e.key === "j" || e.key === "J") {
        if (currentShlokaNum && currentShlokaNum > 1) {
          const prev = currentShlokaNum - 1;
          document.getElementById(`shloka-${prev}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          playShloka(prev);
        }
      } else if (e.key === "k" || e.key === "K") {
        if (currentShlokaNum && currentShlokaNum < 20) {
          const next = currentShlokaNum + 1;
          document.getElementById(`shloka-${next}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          playShloka(next);
        }
      }
    });
  }

  // Helper: Format Seconds to M:SS
  function formatTime(sec) {
    if (isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // Global Exports for inline onclicks
  window.copyShlokaText = function(num) {
    const shloka = GITA_DATA.find(s => s.num === num);
    if (!shloka) return;
    const text = `${shloka.speaker ? shloka.speaker + '\n' : ''}${shloka.sanskrit.join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      alert(`श्लोक १२.${num} copied to clipboard!`);
    });
  };
});
