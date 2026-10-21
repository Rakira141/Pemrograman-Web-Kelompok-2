document.addEventListener("DOMContentLoaded", () => {
  const rawData = window.RAW_DATASET || [];
  if (!rawData.length) return;

  // DOM Elements
  const yearFilter = document.getElementById("yearFilter");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");
  const searchTable = document.getElementById("searchTable");
  const mapMetricSelect = document.getElementById("mapMetric");
  const radarWilayahASelect = document.getElementById("radarWilayahA");
  const radarWilayahBSelect = document.getElementById("radarWilayahB");
  const scatterMetricXSelect = document.getElementById("scatterMetricX");
  const btnExportCsv = document.getElementById("btnExportCsv");
  const btnPrintReport = document.getElementById("btnPrintReport");
  const filterPillBtns = document.querySelectorAll(".filter-pill-btn");

  let barChart = null;
  let pieChart = null;
  let radarChart = null;
  let scatterChart = null;
  let leafletMap = null;
  let tileLayer = null;
  let mapMarkers = [];

  let currentCategoryFilter = "ALL";
  let currentSearchQuery = "";
  let currentSortColumn = "IPM";
  let currentSortDirection = "desc";

  // Database Koordinat Resmi 35 Kabupaten / Kota di Jawa Tengah
  const REGION_COORDS = {
    "Kab. Banjarnegara": [-7.3987, 109.6974],
    "Kab. Banyumas":     [-7.5147, 109.2941],
    "Kab. Batang":       [-7.0097, 109.8789],
    "Kab. Blora":        [-7.0673, 111.4184],
    "Kab. Boyolali":     [-7.5361, 110.5944],
    "Kab. Brebes":       [-6.9745, 108.9719],
    "Kab. Cilacap":      [-7.5562, 108.9868],
    "Kab. Demak":        [-6.8906, 110.6397],
    "Kab. Grobogan":     [-7.1130, 110.9168],
    "Kab. Jepara":       [-6.5892, 110.6684],
    "Kab. Karanganyar":  [-7.5964, 110.9472],
    "Kab. Kebumen":      [-7.6699, 109.6521],
    "Kab. Kendal":       [-7.0253, 110.2038],
    "Kab. Klaten":       [-7.7056, 110.6044],
    "Kab. Kudus":        [-6.8048, 110.8405],
    "Kab. Magelang":     [-7.4646, 110.2178],
    "Kab. Pati":         [-6.7554, 111.0379],
    "Kab. Pekalongan":   [-7.0377, 109.6264],
    "Kab. Pemalang":     [-6.8912, 109.3809],
    "Kab. Purbalingga":  [-7.3009, 109.3512],
    "Kab. Purworejo":    [-7.7137, 110.0078],
    "Kab. Rembang":      [-6.7118, 111.3444],
    "Kab. Semarang":     [-7.2104, 110.4372],
    "Kab. Sragen":       [-7.4268, 111.0222],
    "Kab. Sukoharjo":    [-7.6826, 110.8354],
    "Kab. Tegal":        [-7.0425, 109.1539],
    "Kab. Temanggung":   [-7.3175, 110.1772],
    "Kab. Wonogiri":     [-7.8139, 110.9254],
    "Kab. Wonosobo":     [-7.3614, 109.9002],
    "Kota Magelang":     [-7.4705, 110.2178],
    "Kota Pekalongan":   [-6.8886, 109.6753],
    "Kota Salatiga":     [-7.3305, 110.5084],
    "Kota Semarang":     [-6.9932, 110.4203],
    "Kota Surakarta":    [-7.5666, 110.8267],
    "Kota Tegal":        [-6.8677, 109.1402]
  };

  // Cek preferensi tema
  const savedTheme = localStorage.getItem("themePreference");
  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
  }

  function syncThemeUI() {
    const isLight = document.body.classList.contains("light-mode");
    if (themeIcon && themeText) {
      themeIcon.textContent = isLight ? "🌙" : "☀️";
      themeText.textContent = isLight ? "Mode Gelap" : "Mode Terang";
    }
  }
  syncThemeUI();

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("light-mode");
      const isLight = document.body.classList.contains("light-mode");
      localStorage.setItem("themePreference", isLight ? "light" : "dark");
      syncThemeUI();
      updateDashboard();
    });
  }

  // Populate Dropdown Wilayah untuk Radar Chart Komparasi
  const uniqueWilayahList = [...new Set(rawData.map(d => d.Wilayah))].sort();
  if (radarWilayahASelect && radarWilayahBSelect) {
    radarWilayahASelect.innerHTML = uniqueWilayahList.map(w => 
      `<option value="${w}" ${w === "Kota Semarang" ? "selected" : ""}>${w}</option>`
    ).join("");
    radarWilayahBSelect.innerHTML = uniqueWilayahList.map(w => 
      `<option value="${w}" ${w === "Kab. Brebes" ? "selected" : ""}>${w}</option>`
    ).join("");

    radarWilayahASelect.addEventListener("change", renderRadarChart);
    radarWilayahBSelect.addEventListener("change", renderRadarChart);
  }

  if (scatterMetricXSelect) {
    scatterMetricXSelect.addEventListener("change", renderScatterChart);
  }

  if (mapMetricSelect) {
    mapMetricSelect.addEventListener("change", updateMapMarkers);
  }

  // Inisialisasi Peta Leaflet ESRI (Bebas Watermark)
  function initLeafletMap(isDark) {
    const mapContainer = document.getElementById("mapJateng");
    if (!mapContainer || typeof L === "undefined") return;

    if (!leafletMap) {
      leafletMap = L.map("mapJateng", {
        center: [-7.20, 110.20],
        zoom: 8,
        minZoom: 7,
        maxZoom: 12,
        scrollWheelZoom: false
      });
    }

    if (tileLayer) {
      leafletMap.removeLayer(tileLayer);
    }

    const darkTileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
    const lightTileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";

    tileLayer = L.tileLayer(isDark ? darkTileUrl : lightTileUrl, {
      attribution: '&copy; <a href="https://www.esri.com/" target="_blank">Esri</a> | BPS Jawa Tengah (Domain 3300)',
      maxZoom: 16
    }).addTo(leafletMap);

    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize();
    }, 250);
  }

  // Update Titik Gelembung di Peta sesuai Layer Metrik Pilihan
  function updateMapMarkers() {
    if (!leafletMap || typeof L === "undefined") return;
    mapMarkers.forEach(m => leafletMap.removeLayer(m));
    mapMarkers = [];

    const selectedYear = yearFilter ? yearFilter.value : "2025";
    const currentData = rawData.filter(d => 
      selectedYear === "ALL" ? d.Tahun === 2025 : String(d.Tahun) === selectedYear
    );

    const metric = mapMetricSelect ? mapMetricSelect.value : "IPM";

    currentData.forEach(item => {
      const coords = REGION_COORDS[item.Wilayah];
      if (!coords) return;

      let val = item.IPM;
      let labelMetric = "IPM";
      let unit = "";
      let markerColor = "#3b82f6";
      let markerRadius = 11;

      if (metric === "IPM") {
        val = item.IPM;
        labelMetric = "IPM";
        if (val >= 80) { markerColor = "#5c7a57"; markerRadius = 14; }
        else if (val >= 70) { markerColor = "#c8963e"; markerRadius = 10; }
        else { markerColor = "#b85d43"; markerRadius = 8; }
      } else if (metric === "UHH") {
        val = item.UHH;
        labelMetric = "Umur Harapan Hidup";
        unit = " tahun";
        if (val >= 77) { markerColor = "#5c7a57"; markerRadius = 14; }
        else if (val >= 75) { markerColor = "#c8963e"; markerRadius = 10; }
        else { markerColor = "#b85d43"; markerRadius = 8; }
      } else if (metric === "HLS") {
        val = item.HLS;
        labelMetric = "Harapan Lama Sekolah";
        unit = " tahun";
        if (val >= 14) { markerColor = "#5c7a57"; markerRadius = 14; }
        else if (val >= 13) { markerColor = "#c8963e"; markerRadius = 10; }
        else { markerColor = "#b85d43"; markerRadius = 8; }
      } else if (metric === "RLS") {
        val = item.RLS;
        labelMetric = "Rata-rata Lama Sekolah";
        unit = " tahun";
        if (val >= 10) { markerColor = "#5c7a57"; markerRadius = 14; }
        else if (val >= 8) { markerColor = "#c8963e"; markerRadius = 10; }
        else { markerColor = "#b85d43"; markerRadius = 8; }
      } else if (metric === "Pengeluaran") {
        val = item.Pengeluaran;
        labelMetric = "Pengeluaran Riil per Kapita";
        unit = " ribu Rp/thn";
        if (val >= 14000) { markerColor = "#5c7a57"; markerRadius = 14; }
        else if (val >= 12000) { markerColor = "#c8963e"; markerRadius = 10; }
        else { markerColor = "#b85d43"; markerRadius = 8; }
      }

      const circleMarker = L.circleMarker(coords, {
        radius: markerRadius,
        fillColor: markerColor,
        color: "#ffffff",
        weight: 1.5,
        opacity: 0.95,
        fillOpacity: 0.85
      });

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; min-width: 190px;">
          <div style="font-family: Georgia, serif; font-weight: 700; font-size: 15px; margin-bottom: 2px;">${item.Wilayah}</div>
          <div style="font-size: 11px; opacity: 0.7; margin-bottom: 6px;">Data BPS Tahun ${item.Tahun}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px; padding: 5px 10px; background: rgba(125,163,119,0.12); border-radius: 10px; border: 1px solid rgba(125,163,119,0.2);">
            <span style="font-size: 11.5px;">${labelMetric}:</span>
            <strong style="font-size: 14px; color:${markerColor};">${typeof val === 'number' ? val.toLocaleString('id-ID') : val}${unit}</strong>
          </div>
          <div style="font-size: 11px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
            <div>• Skor IPM: <strong>${item.IPM.toFixed(2)}</strong></div>
            <div>• UHH: <strong>${item.UHH.toFixed(2)}</strong> thn | HLS: <strong>${item.HLS.toFixed(2)}</strong> thn</div>
            <div>• RLS: <strong>${item.RLS.toFixed(2)}</strong> thn | Pengeluaran: <strong>Rp ${item.Pengeluaran.toLocaleString("id-ID")} rb</strong></div>
          </div>
          <button class="btn btn-sm w-100 mt-2 py-1 text-white fw-bold" style="font-size: 11.5px; border-radius: 20px; background-color: #5c7a57; border: none;" onclick="window.openDetailModal('${item.Wilayah}')">Lihat Profil Lengkap</button>
        </div>
      `;

      circleMarker.bindPopup(popupContent);
      circleMarker.bindTooltip(`${item.Wilayah}: ${val.toLocaleString('id-ID')}${unit}`, {
        direction: "top",
        offset: [0, -6]
      });

      circleMarker.addTo(leafletMap);
      mapMarkers.push(circleMarker);
    });
  }

  // 1. Render Radar Chart Komparasi Head-to-Head
  function renderRadarChart() {
    const canvas = document.getElementById("radarChart");
    if (!canvas) return;

    const wilA = radarWilayahASelect ? radarWilayahASelect.value : "Kota Semarang";
    const wilB = radarWilayahBSelect ? radarWilayahBSelect.value : "Kab. Brebes";

    // Ambil data terbaru (2025) untuk kedua wilayah
    const dataA = rawData.find(d => d.Wilayah === wilA && d.Tahun === 2025) || rawData.find(d => d.Wilayah === wilA);
    const dataB = rawData.find(d => d.Wilayah === wilB && d.Tahun === 2025) || rawData.find(d => d.Wilayah === wilB);

    if (!dataA || !dataB) return;

    // Normalisasi Min-Max Skala 0-100 agar seimbang di Radar Chart
    // UHH: min 70, max 80; HLS: min 11, max 16; RLS: min 6, max 12; Pengeluaran: min 10000, max 18000
    const norm = (v, min, max) => Math.min(100, Math.max(10, ((v - min) / (max - min)) * 100));

    const scoresA = [
      norm(dataA.UHH, 70, 80),
      norm(dataA.HLS, 11, 16),
      norm(dataA.RLS, 6, 12),
      norm(dataA.Pengeluaran, 10000, 18000)
    ];

    const scoresB = [
      norm(dataB.UHH, 70, 80),
      norm(dataB.HLS, 11, 16),
      norm(dataB.RLS, 6, 12),
      norm(dataB.Pengeluaran, 10000, 18000)
    ];

    const isDark = !document.body.classList.contains("light-mode");
    const gridColor = isDark ? "rgba(255, 255, 255, 0.1)" : "#e4dbc4";
    const textColor = isDark ? "#f5efe4" : "#2b2a26";

    if (radarChart) radarChart.destroy();
    radarChart = new Chart(canvas, {
      type: "radar",
      data: {
        labels: [
          "Kesehatan (UHH)",
          "Ekspektasi Sekolah (HLS)",
          "Tingkat Pendidikan (RLS)",
          "Standar Hidup (Pengeluaran)"
        ],
        datasets: [
          {
            label: `${wilA} (IPM: ${dataA.IPM})`,
            data: scoresA,
            backgroundColor: "rgba(92, 122, 87, 0.35)",
            borderColor: "#5c7a57",
            pointBackgroundColor: "#5c7a57",
            pointBorderColor: "#ffffff",
            borderWidth: 2
          },
          {
            label: `${wilB} (IPM: ${dataB.IPM})`,
            data: scoresB,
            backgroundColor: "rgba(200, 150, 62, 0.35)",
            borderColor: "#c8963e",
            pointBackgroundColor: "#c8963e",
            pointBorderColor: "#ffffff",
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: textColor, font: { family: "system-ui", weight: "600" } }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const isA = ctx.datasetIndex === 0;
                const d = isA ? dataA : dataB;
                const idx = ctx.dataIndex;
                let rawStr = "";
                if (idx === 0) rawStr = `UHH: ${d.UHH} thn`;
                if (idx === 1) rawStr = `HLS: ${d.HLS} thn`;
                if (idx === 2) rawStr = `RLS: ${d.RLS} thn`;
                if (idx === 3) rawStr = `Pengeluaran: Rp ${d.Pengeluaran.toLocaleString('id-ID')} rb`;
                return `${ctx.dataset.label.split(" ")[0]}: ${rawStr}`;
              }
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { display: false },
            grid: { color: gridColor },
            angleLines: { color: gridColor },
            pointLabels: {
              color: textColor,
              font: { family: "system-ui", size: 11.5, weight: "600" }
            }
          }
        }
      }
    });
  }

  // 2. Render Scatter Plot Korelasi & Regresi Linear
  function renderScatterChart() {
    const canvas = document.getElementById("scatterChart");
    if (!canvas) return;

    const metricX = scatterMetricXSelect ? scatterMetricXSelect.value : "Pengeluaran";
    const data2025 = rawData.filter(d => d.Tahun === 2025);

    const scatterPoints = data2025.map(d => ({
      x: d[metricX],
      y: d.IPM,
      name: d.Wilayah
    }));

    // Hitung Regresi Linear Sederhana y = mx + c & Korelasi Pearson r
    const n = scatterPoints.length;
    const sumX = scatterPoints.reduce((acc, p) => acc + p.x, 0);
    const sumY = scatterPoints.reduce((acc, p) => acc + p.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    scatterPoints.forEach(p => {
      const dx = p.x - meanX;
      const dy = p.y - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    });

    const m = denX !== 0 ? num / denX : 0;
    const c = meanY - m * meanX;
    const r = (Math.sqrt(denX) * Math.sqrt(denY)) !== 0 ? num / (Math.sqrt(denX) * Math.sqrt(denY)) : 0;
    const r2 = r * r;

    // Tampilkan Indikator Korelasi
    const corrREl = document.getElementById("corrR");
    const corrR2El = document.getElementById("corrR2");
    const corrStatusEl = document.getElementById("corrStatus");
    const scatterSubtitleEl = document.getElementById("scatterSubtitle");

    if (corrREl) corrREl.textContent = `r = ${r.toFixed(3)}`;
    if (corrR2El) corrR2El.textContent = `${(r2 * 100).toFixed(1)}%`;
    if (corrStatusEl) {
      if (Math.abs(r) >= 0.8) {
        corrStatusEl.textContent = "Korelasi Sangat Kuat";
        corrStatusEl.className = "badge badge-cat badge-st";
      } else if (Math.abs(r) >= 0.6) {
        corrStatusEl.textContent = "Korelasi Kuat";
        corrStatusEl.className = "badge badge-cat badge-t";
      } else {
        corrStatusEl.textContent = "Korelasi Sedang";
        corrStatusEl.className = "badge badge-cat badge-s";
      }
    }

    if (scatterSubtitleEl) {
      scatterSubtitleEl.textContent = `${metricX} vs Indeks Pembangunan Manusia (IPM 2025)`;
    }

    // Buat 2 titik garis tren regresi (min & max X)
    const minX = Math.min(...scatterPoints.map(p => p.x));
    const maxX = Math.max(...scatterPoints.map(p => p.x));
    const trendLine = [
      { x: minX, y: Number((m * minX + c).toFixed(2)) },
      { x: maxX, y: Number((m * maxX + c).toFixed(2)) }
    ];

    const isDark = !document.body.classList.contains("light-mode");
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "#e4dbc4";
    const textColor = isDark ? "#f5efe4" : "#2b2a26";
    const mutedColor = isDark ? "#b3ab98" : "#756e5c";

    if (scatterChart) scatterChart.destroy();
    scatterChart = new Chart(canvas, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Kabupaten / Kota",
            data: scatterPoints,
            backgroundColor: "#5c7a57",
            pointRadius: 6,
            pointHoverRadius: 8
          },
          {
            type: "line",
            label: `Garis Tren (y = ${m.toFixed(4)}x + ${c.toFixed(2)})`,
            data: trendLine,
            borderColor: "#c8963e",
            borderWidth: 2,
            borderDash: [6, 6],
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: textColor, font: { family: "system-ui" } }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                if (ctx.datasetIndex === 0) {
                  const raw = ctx.raw;
                  return `${raw.name}: ${metricX} = ${raw.x.toLocaleString('id-ID')}, IPM = ${raw.y}`;
                }
                return ctx.dataset.label;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: metricX, color: textColor, font: { weight: "600" } },
            grid: { color: gridColor },
            ticks: { color: mutedColor }
          },
          y: {
            title: { display: true, text: "IPM", color: textColor, font: { weight: "600" } },
            grid: { color: gridColor },
            ticks: { color: mutedColor }
          }
        }
      }
    });
  }

  // 3. Render Kotak Temuan Kunci / Key Insights Otomatis
  function updateKeyInsights(dataYear, selectedYear) {
    const container = document.getElementById("insightsContainer");
    const yearLabel = document.getElementById("insightYearLabel");
    if (!container) return;

    if (yearLabel) yearLabel.textContent = selectedYear === "ALL" ? "2024-2025" : selectedYear;

    const sorted = [...dataYear].sort((a, b) => b.IPM - a.IPM);
    const topWil = sorted[0];
    const btmWil = sorted[sorted.length - 1];
    const gap = (topWil.IPM - btmWil.IPM).toFixed(2);

    const stCount = dataYear.filter(d => d.IPM >= 80).length;
    const tCount  = dataYear.filter(d => d.IPM >= 70 && d.IPM < 80).length;
    const sCount  = dataYear.filter(d => d.IPM < 70).length;

    // Cari Wilayah Pertumbuhan Tercepat 2024 -> 2025
    let fastestGrowthText = "";
    const data2024 = rawData.filter(d => d.Tahun === 2024);
    const data2025 = rawData.filter(d => d.Tahun === 2025);

    let maxGrowth = -999;
    let maxGrowthWilayah = "";

    data2025.forEach(d25 => {
      const d24 = data2024.find(item => item.Wilayah === d25.Wilayah);
      if (d24) {
        const diff = d25.IPM - d24.IPM;
        if (diff > maxGrowth) {
          maxGrowth = diff;
          maxGrowthWilayah = d25.Wilayah;
        }
      }
    });

    fastestGrowthText = `${maxGrowthWilayah} (+${maxGrowth.toFixed(2)} poin)`;

    // Update KPI Pertumbuhan jika ada elemennya
    const kGrowthEl = document.getElementById("kGrowth");
    const kGrowthNameEl = document.getElementById("kGrowthName");
    if (kGrowthEl) kGrowthEl.textContent = `+${maxGrowth.toFixed(2)}`;
    if (kGrowthNameEl) kGrowthNameEl.textContent = `${maxGrowthWilayah} (2024→2025)`;

    container.innerHTML = `
      <div class="col-md-4">
        <div class="insight-pill">
          <span class="insight-number">01</span>
          <div>
            <div class="small text-muted fw-bold">Disparitas Tertinggi & Terendah</div>
            <div class="fw-bold fs-6">Kesenjangan ${gap} Poin</div>
            <div class="small opacity-75">${topWil.Wilayah} (${topWil.IPM}) vs ${btmWil.Wilayah} (${btmWil.IPM})</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="insight-pill">
          <span class="insight-number">02</span>
          <div>
            <div class="small text-muted fw-bold">Distribusi Kategori IPM</div>
            <div class="fw-bold fs-6">${stCount} Sangat Tinggi, ${tCount} Tinggi, ${sCount} Sedang</div>
            <div class="small opacity-75">Mayoritas wilayah berada pada kategori status Tinggi</div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="insight-pill">
          <span class="insight-number">03</span>
          <div>
            <div class="small text-muted fw-bold">Pertumbuhan Tercepat (Most Improved)</div>
            <div class="fw-bold fs-6" style="color: var(--accent-amber);">${fastestGrowthText}</div>
            <div class="small opacity-75">Laju akselerasi IPM tertinggi dalam 1 tahun terakhir</div>
          </div>
        </div>
      </div>
    `;
  }

  // 4. Modal Detail Profil Wilayah (Drill-Down Modal)
  window.openDetailModal = function(wilayahName) {
    const modalEl = document.getElementById("wilayahModal");
    if (!modalEl || typeof bootstrap === "undefined") return;

    const data2025 = rawData.find(d => d.Wilayah === wilayahName && d.Tahun === 2025);
    const data2024 = rawData.find(d => d.Wilayah === wilayahName && d.Tahun === 2024);
    if (!data2025) return;

    const sorted2025 = [...rawData.filter(d => d.Tahun === 2025)].sort((a, b) => b.IPM - a.IPM);
    const rank = sorted2025.findIndex(d => d.Wilayah === wilayahName) + 1;

    const modalTitle = document.getElementById("modalWilayahTitle");
    const modalRank = document.getElementById("modalWilayahRank");
    const modalBody = document.getElementById("modalWilayahBody");

    let catBadge = "badge-s";
    let catText = "Sedang";
    if (data2025.IPM >= 80) { catBadge = "badge-st"; catText = "Sangat Tinggi"; }
    else if (data2025.IPM >= 70) { catBadge = "badge-t"; catText = "Tinggi"; }

    if (modalTitle) modalTitle.innerHTML = `${wilayahName} <span class="badge ${catBadge} badge-cat ms-2">${catText}</span>`;
    if (modalRank) modalRank.textContent = `Peringkat #${rank} dari 35 Kabupaten/Kota di Jawa Tengah`;

    const deltaIPM = data2024 ? (data2025.IPM - data2024.IPM).toFixed(2) : "0.00";
    const deltaUHH = data2024 ? (data2025.UHH - data2024.UHH).toFixed(2) : "0.00";
    const deltaHLS = data2024 ? (data2025.HLS - data2024.HLS).toFixed(2) : "0.00";
    const deltaRLS = data2024 ? (data2025.RLS - data2024.RLS).toFixed(2) : "0.00";
    const deltaPengeluaran = data2024 ? (data2025.Pengeluaran - data2024.Pengeluaran) : 0;

    if (modalBody) {
      modalBody.innerHTML = `
        <div class="row g-3 mb-4">
          <div class="col-md-4">
            <div class="detail-metric-card text-center">
              <span class="small text-muted fw-bold">SKOR IPM 2025</span>
              <h2 class="fw-bold text-primary my-1">${data2025.IPM.toFixed(2)}</h2>
              <small class="text-success fw-semibold">▲ +${deltaIPM} dari 2024 (${data2024 ? data2024.IPM : '-'})</small>
            </div>
          </div>
          <div class="col-md-4">
            <div class="detail-metric-card text-center">
              <span class="small text-muted fw-bold">UMUR HARAPAN HIDUP</span>
              <h2 class="fw-bold text-success my-1">${data2025.UHH.toFixed(2)} <span class="fs-6 text-muted">thn</span></h2>
              <small class="text-success fw-semibold">▲ +${deltaUHH} tahun</small>
            </div>
          </div>
          <div class="col-md-4">
            <div class="detail-metric-card text-center">
              <span class="small text-muted fw-bold">PENGELUARAN RIIL</span>
              <h2 class="fw-bold text-warning my-1">Rp ${data2025.Pengeluaran.toLocaleString('id-ID')} <span class="fs-6 text-muted">rb</span></h2>
              <small class="text-success fw-semibold">▲ +Rp ${deltaPengeluaran.toLocaleString('id-ID')} rb</small>
            </div>
          </div>
        </div>

        <h6 class="fw-bold mb-3">Dimensi Pendidikan:</h6>
        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <div class="detail-metric-card">
              <div class="d-flex justify-content-between">
                <span class="small text-muted">Harapan Lama Sekolah (HLS)</span>
                <strong>${data2025.HLS.toFixed(2)} Tahun</strong>
              </div>
              <div class="progress mt-2" style="height: 6px;">
                <div class="progress-bar bg-info" style="width: ${(data2025.HLS / 16) * 100}%"></div>
              </div>
              <small class="text-muted mt-1 d-block">Pertumbuhan: +${deltaHLS} tahun</small>
            </div>
          </div>
          <div class="col-md-6">
            <div class="detail-metric-card">
              <div class="d-flex justify-content-between">
                <span class="small text-muted">Rata-rata Lama Sekolah (RLS)</span>
                <strong>${data2025.RLS.toFixed(2)} Tahun</strong>
              </div>
              <div class="progress mt-2" style="height: 6px;">
                <div class="progress-bar bg-primary" style="width: ${(data2025.RLS / 12) * 100}%"></div>
              </div>
              <small class="text-muted mt-1 d-block">Pertumbuhan: +${deltaRLS} tahun</small>
            </div>
          </div>
        </div>

        <div class="p-3 rounded-4" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-card);">
          <small class="text-muted">
            ℹ️ Data bersumber dari rilis resmi BPS Provinsi Jawa Tengah (Metode Baru Hasil Long Form SP2020).
          </small>
        </div>
      `;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  };

  // 5. Ekspor CSV Data Tabel
  if (btnExportCsv) {
    btnExportCsv.addEventListener("click", () => {
      const selectedYear = yearFilter ? yearFilter.value : "2025";
      const currentData = rawData.filter(d => 
        selectedYear === "ALL" ? true : String(d.Tahun) === selectedYear
      );

      let csv = "No,Kabupaten_Kota,Tahun,IPM,UHH_Tahun,HLS_Tahun,RLS_Tahun,Pengeluaran_Ribu_Rp,Kategori\n";
      currentData.forEach((d, i) => {
        let catText = "Sedang";
        if (d.IPM >= 80) catText = "Sangat Tinggi";
        else if (d.IPM >= 70) catText = "Tinggi";

        csv += `${i+1},"${d.Wilayah}",${d.Tahun},${d.IPM},${d.UHH},${d.HLS},${d.RLS},${d.Pengeluaran},"${catText}"\n`;
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `IPM_Jawa_Tengah_${selectedYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // 6. Cetak Laporan / Simpan PDF
  if (btnPrintReport) {
    btnPrintReport.addEventListener("click", () => {
      window.print();
    });
  }

  // 7. Live Search & Filter Badge Kategori pada Tabel
  if (searchTable) {
    searchTable.addEventListener("input", (e) => {
      currentSearchQuery = e.target.value.toLowerCase().trim();
      renderFilteredTable();
    });
  }

  filterPillBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterPillBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategoryFilter = btn.getAttribute("data-cat");
      renderFilteredTable();
    });
  });

  // Event listener untuk Header Tabel yang Dapat Diurutkan (Sortable Columns)
  function initTableSorting() {
    const sortableHeaders = document.querySelectorAll(".sortable-th");
    sortableHeaders.forEach(th => {
      th.addEventListener("click", () => {
        const col = th.getAttribute("data-col");
        if (currentSortColumn === col) {
          // Toggle arah jika kolom yang sama diklik ulang
          currentSortDirection = currentSortDirection === "desc" ? "asc" : "desc";
        } else {
          currentSortColumn = col;
          // Wilayah default A-Z (asc), angka default terbesar ke terkecil (desc)
          currentSortDirection = (col === "Wilayah") ? "asc" : "desc";
        }
        updateSortIcons();
        renderFilteredTable();
      });
    });
  }

  function updateSortIcons() {
    document.querySelectorAll(".sortable-th").forEach(th => {
      const col = th.getAttribute("data-col");
      const icon = th.querySelector(".sort-icon");
      if (col === currentSortColumn) {
        th.classList.add("active-sort");
        if (icon) icon.textContent = currentSortDirection === "desc" ? "▼" : "▲";
      } else {
        th.classList.remove("active-sort");
        if (icon) icon.textContent = "⇅";
      }
    });
  }

  initTableSorting();

  function renderFilteredTable() {
    const selectedYear = yearFilter ? yearFilter.value : "2025";
    const dataYear = rawData.filter(d => 
      selectedYear === "ALL" ? true : String(d.Tahun) === selectedYear
    );

    const tbody = document.getElementById("tbody");
    if (!tbody) return;

    let filtered = dataYear.filter(d => {
      // Filter Kategori
      let catText = "Sedang";
      if (d.IPM >= 80) catText = "Sangat Tinggi";
      else if (d.IPM >= 70) catText = "Tinggi";

      const matchesCat = currentCategoryFilter === "ALL" || catText === currentCategoryFilter;
      const matchesSearch = !currentSearchQuery || d.Wilayah.toLowerCase().includes(currentSearchQuery);

      return matchesCat && matchesSearch;
    });

    // Logika Pengurutan Kolom (Ascending & Descending)
    filtered.sort((a, b) => {
      let valA = a[currentSortColumn];
      let valB = b[currentSortColumn];

      if (currentSortColumn === "Kategori") {
        valA = a.IPM;
        valB = b.IPM;
      }

      if (typeof valA === "string") {
        return currentSortDirection === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return currentSortDirection === "asc"
          ? valA - valB
          : valB - valA;
      }
    });

    tbody.innerHTML = filtered.map((d, i) => {
      let catClass = "badge-s";
      let catText = "Sedang";
      if (d.IPM >= 80) { catClass = "badge-st"; catText = "Sangat Tinggi"; }
      else if (d.IPM >= 70) { catClass = "badge-t"; catText = "Tinggi"; }

      return `<tr onclick="window.openDetailModal('${d.Wilayah}')" title="Klik untuk lihat profil detail">
        <td class="text-muted small">${i + 1}</td>
        <td class="text-start fw-semibold">${d.Wilayah} <span class="badge bg-secondary p-1 ms-1 d-none d-md-inline" style="font-size:9px; border-radius:10px;">🔍 Detail</span></td>
        <td><span class="year-badge">${d.Tahun}</span></td>
        <td class="fw-bold text-kpi-avg">${d.IPM.toFixed(2)}</td>
        <td>${d.UHH.toFixed(2)}</td>
        <td>${d.HLS.toFixed(2)}</td>
        <td>${d.RLS.toFixed(2)}</td>
        <td>${d.Pengeluaran.toLocaleString("id-ID")}</td>
        <td><span class="badge ${catClass} badge-cat">${catText}</span></td>
      </tr>`;
    }).join("");

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">Tidak ada wilayah yang sesuai dengan filter atau kata kunci pencarian.</td></tr>`;
    }
  }

  // Update Seluruh Dashboard
  function updateDashboard() {
    const selectedYear = yearFilter ? yearFilter.value : "2025";
    const filteredData = rawData.filter(d => 
      selectedYear === "ALL" ? true : String(d.Tahun) === selectedYear
    );

    const isDark = !document.body.classList.contains("light-mode");

    // 1. Update KPI
    const countEl = document.getElementById("kCount");
    if (countEl) countEl.textContent = `${filteredData.length} Kab/Kota`;

    const sorted = [...filteredData].sort((a, b) => b.IPM - a.IPM);
    const avg = filteredData.reduce((acc, curr) => acc + curr.IPM, 0) / (filteredData.length || 1);

    const avgEl = document.getElementById("kAvg");
    const maxEl = document.getElementById("kMax");
    const maxNameEl = document.getElementById("kMaxName");
    const minEl = document.getElementById("kMin");
    const minNameEl = document.getElementById("kMinName");

    if (avgEl) avgEl.textContent = avg.toFixed(2);
    if (maxEl && sorted.length) maxEl.textContent = sorted[0].IPM.toFixed(2);
    if (maxNameEl && sorted.length) maxNameEl.textContent = `${sorted[0].Wilayah}`;
    if (minEl && sorted.length) minEl.textContent = sorted[sorted.length - 1].IPM.toFixed(2);
    if (minNameEl && sorted.length) minNameEl.textContent = `${sorted[sorted.length - 1].Wilayah}`;

    const barTitleEl = document.getElementById("barTitle");
    const tableTitleEl = document.getElementById("tableTitle");
    if (barTitleEl) barTitleEl.textContent = `Top 10 IPM Kabupaten/Kota di Jawa Tengah`;
    if (tableTitleEl) tableTitleEl.textContent = `Data IPM & Komponen Pembentuk (${filteredData.length} Kabupaten/Kota)`;

    // 2. Render Table
    renderFilteredTable();

    // 3. Render Top 10 Horizontal Bar Chart
    const top10 = [...filteredData].sort((a, b) => b.IPM - a.IPM).slice(0, 10);
    const barCanvas = document.getElementById("barChart");
    const textColor = isDark ? "#f5efe4" : "#2b2a26";
    const mutedColor = isDark ? "#b3ab98" : "#756e5c";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "#e4dbc4";
    const barBgColor = isDark ? "#7da377" : "#5c7a57";

    if (barCanvas) {
      if (barChart) barChart.destroy();
      barChart = new Chart(barCanvas, {
        type: "bar",
        data: {
          labels: top10.map(d => selectedYear === "ALL" ? `${d.Wilayah} (${d.Tahun})` : d.Wilayah),
          datasets: [{
            label: "Nilai IPM",
            data: top10.map(d => d.IPM),
            backgroundColor: barBgColor,
            borderRadius: 8
          }]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: isDark ? "#252420" : "#ffffff",
              titleColor: isDark ? "#f5efe4" : "#2b2a26",
              bodyColor: isDark ? "#f5efe4" : "#2b2a26",
              borderColor: isDark ? "#3d3a33" : "#e4dbc4",
              borderWidth: 1,
              padding: 10,
              cornerRadius: 12
            }
          },
          scales: {
            x: {
              min: 0,
              max: 90,
              grid: { color: gridColor },
              ticks: { color: mutedColor, font: { family: "system-ui" } }
            },
            y: {
              grid: { display: false },
              ticks: { color: textColor, font: { family: "Georgia, serif", weight: "500" } }
            }
          }
        }
      });
    }

    // 4. Render Doughnut Chart (Rounded Ends & Spacing)
    const stCount = filteredData.filter(d => d.IPM >= 80).length;
    const tCount  = filteredData.filter(d => d.IPM >= 70 && d.IPM < 80).length;
    const sCount  = filteredData.filter(d => d.IPM < 70).length;

    const pieCanvas = document.getElementById("pieChart");
    if (pieCanvas) {
      if (pieChart) pieChart.destroy();
      pieChart = new Chart(pieCanvas, {
        type: "doughnut",
        data: {
          labels: ["Sangat Tinggi (≥80)", "Tinggi (70-79)", "Sedang (<70)"],
          datasets: [{
            data: [stCount, tCount, sCount],
            backgroundColor: ["#5c7a57", "#c8963e", "#b85d43"],
            borderRadius: 16,
            spacing: 6,
            borderWidth: 0
          }]
        },
        options: {
          cutout: "75%",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: textColor,
                font: { family: "system-ui", size: 12 },
                padding: 16,
                usePointStyle: true,
                pointStyle: "circle"
              }
            },
            tooltip: {
              backgroundColor: isDark ? "#0f172a" : "#1e293b",
              titleColor: "#ffffff",
              bodyColor: "#ffffff",
              borderColor: isDark ? "#334155" : "#cbd5e1",
              borderWidth: 1,
              padding: 10,
              cornerRadius: 10
            }
          }
        }
      });
    }

    // 5. Update Inovasi Baru:
    updateKeyInsights(filteredData, selectedYear);
    renderRadarChart();
    renderScatterChart();

    // 6. Peta Leaflet
    initLeafletMap(isDark);
    updateMapMarkers();
  }

  if (yearFilter) {
    yearFilter.addEventListener("change", updateDashboard);
  }
  updateDashboard();
});