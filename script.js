document.addEventListener("DOMContentLoaded", () => {
  const HIGHLIGHT_DURATION_MS = 600;
  const COUNTRY_API_BASE_URL = "https://countries.dev/alpha";
  const countryPaths = document.querySelectorAll("#world-map-svg path[data-country]");

  const modalEl = document.getElementById("countryModal");
  const bsModal = new bootstrap.Modal(modalEl);
  const modalMessageEl = document.getElementById("countryModalMessage");
  const modalContentEl = document.getElementById("countryModalContent");
  const modalFlagEl = document.getElementById("countryModalFlag");
  const modalNameEl = document.getElementById("countryModalName");
  const modalCapitalEl = document.getElementById("countryModalCapital");
  const modalPopulationEl = document.getElementById("countryModalPopulation");
  const modalLanguagesEl = document.getElementById("countryModalLanguages");
  const modalRegionEl = document.getElementById("countryModalRegion");

  function withKorean(koreanText, originalText) {
    return koreanText ? `${koreanText} (${originalText})` : originalText;
  }

  function showModalMessage(message) {
    modalContentEl.classList.add("d-none");
    modalMessageEl.textContent = message;
    modalMessageEl.classList.remove("d-none");
    bsModal.show();
  }

  function showModalContent(countryInfo) {
    modalFlagEl.src = countryInfo.flagUrl;
    modalFlagEl.alt = `${countryInfo.name} 국기`;
    modalNameEl.textContent = countryInfo.name;
    modalCapitalEl.textContent = countryInfo.capital;
    modalPopulationEl.textContent = countryInfo.population;
    modalLanguagesEl.textContent = countryInfo.languages;
    modalRegionEl.textContent = countryInfo.region;

    modalMessageEl.classList.add("d-none");
    modalContentEl.classList.remove("d-none");
    bsModal.show();
  }

  let activeAbortController = null;

  async function fetchCountryInfo(countryCode) {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    const abortController = new AbortController();
    activeAbortController = abortController;

    try {
      const response = await fetch(`${COUNTRY_API_BASE_URL}/${countryCode}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`요청 실패 (status: ${response.status})`);
      }

      const data = await response.json();

      const countryInfo = {
        name: withKorean(COUNTRY_NAME_KO[countryCode], data.name ?? "-"),
        flagUrl: data.flags?.svg ?? data.flags?.png ?? "",
        capital: data.capital ? withKorean(CAPITAL_NAME_KO[countryCode], data.capital) : "-",
        population: typeof data.population === "number" ? data.population.toLocaleString() : "-",
        languages:
          Array.isArray(data.languages) && data.languages.length > 0
            ? data.languages
                .map((lang) => withKorean(LANGUAGE_NAME_KO[lang.iso639_1], lang.name))
                .join(", ")
            : "-",
        region: withKorean(REGION_NAME_KO[data.region], data.region ?? "-"),
      };

      console.log(`[${countryCode}] 국가 정보 조회 성공`);
      console.table(countryInfo);

      showModalContent(countryInfo);
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      console.error(`[${countryCode}] 국가 정보를 불러오지 못했습니다:`, error.message);
      showModalMessage("정보를 불러올 수 없습니다.");
    }
  }

  countryPaths.forEach((path) => {
    path.addEventListener("click", () => {
      const countryCode = path.dataset.country;
      console.log("클릭된 국가:", countryCode);

      if (path.highlightTimeoutId) {
        clearTimeout(path.highlightTimeoutId);
      }

      path.classList.add("selected");
      path.highlightTimeoutId = setTimeout(() => {
        path.classList.remove("selected");
        path.highlightTimeoutId = null;
      }, HIGHLIGHT_DURATION_MS);

      fetchCountryInfo(countryCode);
    });
  });

  // 지도 확대/축소 (PC: +/- 버튼, 모바일: 핀치/드래그)
  const svgEl = document.getElementById("world-map-svg");

  const touchEventsHandler = {
    haltEventListeners: ["touchstart", "touchend", "touchmove", "touchleave", "touchcancel"],
    init: function (options) {
      const instance = options.instance;
      let initialScale = 1;
      let pannedX = 0;
      let pannedY = 0;

      this.hammer = Hammer(options.svgElement, {
        inputClass: Hammer.TouchInput,
      });

      this.hammer.get("pinch").set({ enable: true });
      // 기본 프리셋은 pan을 가로 방향으로만 인식하므로 자유 드래그가 가능하도록 전체 방향으로 변경
      this.hammer.get("pan").set({ direction: Hammer.DIRECTION_ALL });

      this.hammer.on("panstart panmove", (ev) => {
        if (ev.type === "panstart") {
          pannedX = 0;
          pannedY = 0;
        }
        instance.panBy({ x: ev.deltaX - pannedX, y: ev.deltaY - pannedY });
        pannedX = ev.deltaX;
        pannedY = ev.deltaY;
      });

      this.hammer.on("pinchstart pinchmove", (ev) => {
        if (ev.type === "pinchstart") {
          initialScale = instance.getZoom();
        }
        // zoomAtPoint는 SVG 좌표계의 점을 기대하므로, 화면 좌표(clientX/Y)인
        // ev.center를 getScreenCTM 역행렬로 변환해야 손가락이 있는 지점이 확대 중심이 된다.
        const screenPoint = options.svgElement.createSVGPoint();
        screenPoint.x = ev.center.x;
        screenPoint.y = ev.center.y;
        const svgPoint = screenPoint.matrixTransform(
          options.svgElement.getScreenCTM().inverse()
        );
        instance.zoomAtPoint(initialScale * ev.scale, svgPoint);
      });

      options.svgElement.addEventListener("touchmove", (e) => e.preventDefault());
    },
    destroy: function () {
      this.hammer.destroy();
    },
  };

  const panZoomInstance = svgPanZoom(svgEl, {
    zoomEnabled: true,
    panEnabled: true,
    controlIconsEnabled: false,
    fit: true,
    center: true,
    minZoom: 1,
    maxZoom: 8,
    zoomScaleSensitivity: 0.3,
    customEventsHandler: touchEventsHandler,
  });

  document.getElementById("zoomInBtn").addEventListener("click", () => {
    panZoomInstance.zoomIn();
  });

  document.getElementById("zoomOutBtn").addEventListener("click", () => {
    panZoomInstance.zoomOut();
  });

  window.addEventListener("resize", () => {
    panZoomInstance.resize();
    panZoomInstance.fit();
    panZoomInstance.center();
  });
});
