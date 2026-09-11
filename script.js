/* =========================================================
   JAL-DRISHTI AI | FINAL FUNCTIONALITY PATCH
   PART 1 / 3
   ---------------------------------------------------------
   Adds:
   1. Light / Dark mode
   2. Fullscreen
   3. Live sensor trend protection
   4. Extended local sensor history
   5. Sensor historical graph modal
   6. Daily calendar/date selection
   7. Live pH + DO Firebase mapping
   ========================================================= */

(function () {
    "use strict";

    /* =====================================================
       SAFETY HELPERS
       ===================================================== */

    function jdGet(id) {
        return document.getElementById(id);
    }

    function jdNum(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function jdLocalDate(date = new Date()) {
        const d = date instanceof Date ? date : new Date(date);

        if (Number.isNaN(d.getTime())) {
            return "";
        }

        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0")
        ].join("-");
    }

    function jdDisplayDate(dateKey) {
        if (!dateKey) return "--";

        const d = new Date(dateKey + "T00:00:00");

        if (Number.isNaN(d.getTime())) {
            return dateKey;
        }

        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function jdEscape(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =====================================================
       1. LIGHT / DARK MODE
       ===================================================== */

    function jdUpdateThemeButton() {
        const root = document.documentElement;

        const icon = jdGet("themeIcon");
        const text = jdGet("themeText");

        const isLight =
            root.classList.contains("light-theme");

        if (icon) {
            icon.textContent =
                isLight ? "🌙" : "☀️";
        }

        if (text) {
            text.textContent =
                isLight ? "Dark" : "Light";
        }
    }

    function jdInitializeTheme() {

        if (document.documentElement.dataset.jdThemeReady === "1") {
            jdUpdateThemeButton();
            return;
        }

        document.documentElement.dataset.jdThemeReady = "1";

        let savedTheme = null;

        try {
            savedTheme =
                localStorage.getItem("jalDrishtiTheme");
        } catch (error) {
            savedTheme = null;
        }

        if (savedTheme === "light") {
            document.documentElement.classList.add(
                "light-theme"
            );
        }

        if (savedTheme === "dark") {
            document.documentElement.classList.remove(
                "light-theme"
            );
        }

        const button = jdGet("themeToggle");

        if (button) {

            button.addEventListener("click", function () {

                const root =
                    document.documentElement;

                root.classList.toggle(
                    "light-theme"
                );

                const mode =
                    root.classList.contains(
                        "light-theme"
                    )
                        ? "light"
                        : "dark";

                try {
                    localStorage.setItem(
                        "jalDrishtiTheme",
                        mode
                    );
                } catch (error) {
                    console.warn(
                        "Theme storage unavailable"
                    );
                }

                jdUpdateThemeButton();
            });
        }

        jdUpdateThemeButton();
    }


    /* =====================================================
       2. FULLSCREEN
       ===================================================== */

    function jdFullscreenState() {

        const icon =
            jdGet("fullscreenIcon");

        const text =
            jdGet("fullscreenText");

        const active =
            Boolean(document.fullscreenElement);

        if (icon) {
            icon.textContent =
                active ? "⛶" : "⛶";
        }

        if (text) {
            text.textContent =
                active
                    ? "Exit Fullscreen"
                    : "Fullscreen";
        }

        const button =
            jdGet("fullscreenToggle");

        if (button) {
            button.title =
                active
                    ? "Exit Fullscreen"
                    : "Enter Fullscreen";
        }
    }

    async function jdToggleFullscreen() {

        try {

            if (!document.fullscreenElement) {

                if (
                    document.documentElement
                        .requestFullscreen
                ) {
                    await document.documentElement
                        .requestFullscreen();
                }

            } else {

                if (
                    document.exitFullscreen
                ) {
                    await document.exitFullscreen();
                }
            }

        } catch (error) {

            console.warn(
                "Fullscreen unavailable:",
                error
            );
        }

        jdFullscreenState();
    }

    function jdInitializeFullscreen() {

        if (
            document.documentElement
                .dataset.jdFullscreenReady === "1"
        ) {
            jdFullscreenState();
            return;
        }

        document.documentElement
            .dataset.jdFullscreenReady = "1";

        const button =
            jdGet("fullscreenToggle");

        if (button) {

            button.addEventListener(
                "click",
                jdToggleFullscreen
            );
        }

        document.addEventListener(
            "fullscreenchange",
            jdFullscreenState
        );

        jdFullscreenState();
    }


    /* =====================================================
       3. OWN PREVIOUS SENSOR VALUES
       -----------------------------------------------------
       Existing code updates previousSensorValues
       immediately after card rendering.

       Therefore we keep our own previous values so
       Increase / Decrease / Stable always works.
       ===================================================== */

    const jdPreviousValues = {};

    function jdReadSensors() {

        if (
            typeof sensors === "undefined" ||
            !sensors
        ) {
            return null;
        }

        return {
            ph: jdNum(sensors.ph),
            turbidity: jdNum(sensors.turbidity),
            tds: jdNum(sensors.tds),
            temperature: jdNum(sensors.temperature),
            waterLevel: jdNum(sensors.waterLevel),
            rainfall: jdNum(sensors.rainfall),
            do: jdNum(sensors.do)
        };
    }

    function jdTrend(type, current, previous) {

        const thresholds = {
            ph: 0.05,
            turbidity: 0.5,
            tds: 3,
            temperature: 0.08,
            waterLevel: 0.5,
            rainfall: 0.3,
            do: 0.05
        };

        const threshold =
            thresholds[type] ?? 0.05;

        if (
            previous === undefined ||
            previous === null ||
            !Number.isFinite(Number(previous))
        ) {
            return "→ Stable";
        }

        const difference =
            Number(current) - Number(previous);

        if (
            Math.abs(difference) < threshold
        ) {
            return "→ Stable";
        }

        return difference > 0
            ? "↑ Increasing"
            : "↓ Decreasing";
    }

    function jdUpdateTrendLabels(
        before,
        current
    ) {

        if (!before || !current) {
            return;
        }

        const ids = {
            ph: "phTrend",
            turbidity: "turbidityTrend",
            tds: "tdsTrend",
            temperature: "temperatureTrend",
            waterLevel: "waterLevelTrend",
            rainfall: "rainfallTrend",
            do: "doTrend"
        };

        Object.keys(ids).forEach(function (type) {

            const el =
                jdGet(ids[type]);

            if (!el) return;

            el.textContent =
                jdTrend(
                    type,
                    current[type],
                    before[type]
                );

        });
    }


    /* =====================================================
       4. EXTENDED SENSOR HISTORY
       -----------------------------------------------------
       Existing system keeps only a small in-memory history.

       This separate history is stored in localStorage so
       previous days can be opened from the calendar.
       ===================================================== */

    const JD_SENSOR_HISTORY_KEY =
        "jalDrishtiExtendedSensorHistory";

    const JD_RISK_HISTORY_KEY =
        "jalDrishtiExtendedRiskHistory";

    const JD_HISTORY_LIMIT = 20000;
    /* =====================================================
   FIRESTORE PERMANENT SENSOR HISTORY
   ===================================================== */

let jdFirestoreHistoryReady = false;
let jdFirestoreAddDoc = null;
let jdFirestoreCollection = null;
let jdFirestoreGetDocs = null;
let jdFirestoreQuery = null;
let jdFirestoreWhere = null;

async function jdInitializeFirestoreHistory() {

    try {

        if (!window.firebaseDB) {
            console.warn("Firestore database not ready");
            return false;
        }

        const firestore =
            await import(
                "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"
            );

        jdFirestoreAddDoc =
            firestore.addDoc;

        jdFirestoreCollection =
            firestore.collection;

        jdFirestoreGetDocs =
            firestore.getDocs;

        jdFirestoreQuery =
            firestore.query;

        jdFirestoreWhere =
            firestore.where;

        jdFirestoreHistoryReady = true;

        console.log(
            "Permanent sensor history connected"
        );

        return true;

    } catch (error) {

        console.error(
            "Firestore history connection error:",
            error
        );

        return false;
    }
}

jdInitializeFirestoreHistory();


async function jdSaveSensorHistoryToFirestore(record) {

    try {

        if (!jdFirestoreHistoryReady) {
            await jdInitializeFirestoreHistory();
        }

        if (
            !jdFirestoreHistoryReady ||
            !window.firebaseDB
        ) {
            return false;
        }

        await jdFirestoreAddDoc(
            jdFirestoreCollection(
                window.firebaseDB,
                "sensorHistory"
            ),
            record
        );

        console.log(
            "Sensor reading permanently saved:",
            record.timestamp
        );

        return true;

    } catch (error) {

        console.error(
            "Permanent sensor history save error:",
            error
        );

        return false;
    }
}


async function jdLoadSensorHistoryFromFirestore(
    selectedDate
) {

    try {

        if (!jdFirestoreHistoryReady) {
            await jdInitializeFirestoreHistory();
        }

        if (
            !jdFirestoreHistoryReady ||
            !window.firebaseDB
        ) {
            return [];
        }

        const historyRef =
            jdFirestoreCollection(
                window.firebaseDB,
                "sensorHistory"
            );

        const historyQuery =
            jdFirestoreQuery(
                historyRef,
                jdFirestoreWhere(
                    "date",
                    "==",
                    selectedDate
                )
            );

        const snapshot =
            await jdFirestoreGetDocs(
                historyQuery
            );

        const readings = [];

        snapshot.forEach(function (doc) {

            const data = doc.data();

            if (data) {
                readings.push(data);
            }

        });

        readings.sort(function (a, b) {

            return (
                Number(a.timestamp) -
                Number(b.timestamp)
            );

        });

        return readings;

    } catch (error) {

        console.error(
            "Permanent sensor history load error:",
            error
        );

        return [];
    }
}

    function jdLoadStorage(key) {

        try {

            const raw =
                localStorage.getItem(key);

            if (!raw) {
                return [];
            }

            const parsed =
                JSON.parse(raw);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.warn(
                "History read error:",
                error
            );

            return [];
        }
    }

    function jdSaveStorage(
        key,
        value
    ) {

        try {

            localStorage.setItem(
                key,
                JSON.stringify(value)
            );

            return true;

        } catch (error) {

            console.warn(
                "History storage error:",
                error
            );

            return false;
        }
    }

    function jdCaptureSensorHistory() {

        const current =
            jdReadSensors();

        if (!current) {
            return;
        }
        

        const timestamp =
            Date.now();
            if (
    timestamp - jdLastHistoryCaptureAt <
    JD_HISTORY_SAVE_INTERVAL
) {
    return;
}



jdLastHistoryCaptureAt = timestamp;

        const record = {
            timestamp: timestamp,
            date: jdLocalDate(
                new Date(timestamp)
            ),
            time:
                new Date(timestamp)
                    .toLocaleTimeString(
                        "en-IN",
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                        }
                    ),
            ph: current.ph,
            turbidity: current.turbidity,
            tds: current.tds,
            temperature: current.temperature,
            waterLevel: current.waterLevel,
            rainfall: current.rainfall,
            do: current.do
        };

        let history =
            jdLoadStorage(
                JD_SENSOR_HISTORY_KEY
            );

        const last =
            history.length
                ? history[history.length - 1]
                : null;

        /*
         * Avoid duplicate readings when updateDashboard()
         * is triggered more than once during the same
         * sensor update.
         */
        if (
            last &&
            Math.abs(
                timestamp -
                Number(last.timestamp)
            ) < 1000
        ) {
            return;
        }

        history.push(record);

        if (
            history.length >
            JD_HISTORY_LIMIT
        ) {
            history =
                history.slice(
                    history.length -
                    JD_HISTORY_LIMIT
                );
        }

        jdSaveStorage(
            JD_SENSOR_HISTORY_KEY,
            history
        );
        /* PERMANENT FIRESTORE SAVE */
jdSaveSensorHistoryToFirestore(record);

        jdCaptureRiskHistory(
            timestamp,
            current
        );
    }


    /* =====================================================
       5. RISK HISTORY
       ===================================================== */

    function jdCalculateRiskFallback(
        current
    ) {

        let risk = 0;

        if (
            current.ph < 6.5 ||
            current.ph > 8.5
        ) {
            risk += 22;
        } else if (
            current.ph < 6.8 ||
            current.ph > 8.2
        ) {
            risk += 8;
        }

        if (
            current.turbidity > 1500
        ) {
            risk += 25;
        } else if (
            current.turbidity > 800
        ) {
            risk += 12;
        }

        if (
            current.tds > 2500
        ) {
            risk += 20;
        } else if (
            current.tds > 1000
        ) {
            risk += 10;
        }

        if (
            current.temperature < 15 ||
            current.temperature > 40
        ) {
            risk += 12;
        } else if (
            current.temperature < 20 ||
            current.temperature > 35
        ) {
            risk += 5;
        }

        if (
            current.waterLevel > 90 ||
            current.waterLevel < 15
        ) {
            risk += 15;
        } else if (
            current.waterLevel > 80 ||
            current.waterLevel < 25
        ) {
            risk += 7;
        }

        if (
            current.rainfall > 40
        ) {
            risk += 12;
        } else if (
            current.rainfall > 15
        ) {
            risk += 5;
        }

        if (
            current.do < 4
        ) {
            risk += 20;
        } else if (
            current.do < 5.5
        ) {
            risk += 10;
        }

        return Math.round(
            Math.min(
                Math.max(risk, 0),
                100
            )
        );
    }

    function jdCaptureRiskHistory(
        timestamp,
        current
    ) {

        let risk = 0;

        try {

            if (
                typeof calculateRisk ===
                "function"
            ) {
                risk =
                    Number(
                        calculateRisk()
                    );
            } else {
                risk =
                    jdCalculateRiskFallback(
                        current
                    );
            }

        } catch (error) {

            risk =
                jdCalculateRiskFallback(
                    current
                );
        }

        if (!Number.isFinite(risk)) {
            risk = 0;
        }

        const record = {
            timestamp: timestamp,
            date: jdLocalDate(
                new Date(timestamp)
            ),
            time:
                new Date(timestamp)
                    .toLocaleTimeString(
                        "en-IN",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    ),
            risk: Math.round(risk)
        };

        let history =
            jdLoadStorage(
                JD_RISK_HISTORY_KEY
            );

        const last =
            history.length
                ? history[history.length - 1]
                : null;

        if (
            last &&
            Math.abs(
                timestamp -
                Number(last.timestamp)
            ) < 1000
        ) {
            return;
        }

        history.push(record);

        if (
            history.length >
            JD_HISTORY_LIMIT
        ) {
            history =
                history.slice(
                    history.length -
                    JD_HISTORY_LIMIT
                );
        }

        jdSaveStorage(
            JD_RISK_HISTORY_KEY,
            history
        );
    }


    /* =====================================================
       6. SENSOR HISTORY MODAL
       ===================================================== */

    let jdHistoryModal = null;
    let jdLastHistoryCaptureAt = 0;
const JD_HISTORY_SAVE_INTERVAL = 10000;
    let jdSelectedSensor = "temperature";
    let jdSelectedDate =
        jdLocalDate();

    function jdCreateHistoryModal() {

        if (jdHistoryModal) {
            return jdHistoryModal;
        }

        const modal =
            document.createElement("div");

        modal.id =
            "jdSensorHistoryModal";

        modal.innerHTML = `
            <div class="jd-history-backdrop"></div>

            <div class="jd-history-dialog">

                <div class="jd-history-header">

                    <div>
                        <div class="jd-history-title"
                             id="jdHistoryTitle">
                            Sensor Historical Graph
                        </div>

                        <div class="jd-history-subtitle"
                             id="jdHistorySubtitle">
                            Daily sensor readings
                        </div>
                    </div>

                    <button
                        type="button"
                        id="jdHistoryClose"
                        class="jd-history-close">
                        ×
                    </button>

                </div>

                <div class="jd-history-controls">

                    <button
                        type="button"
                        id="jdHistoryPrevious"
                        class="jd-history-nav">
                        ‹
                    </button>

                    <input
                        type="date"
                        id="jdHistoryDate"
                        class="jd-history-date">

                    <button
                        type="button"
                        id="jdHistoryNext"
                        class="jd-history-nav">
                        ›
                    </button>

                </div>

                <div class="jd-history-info"
                     id="jdHistoryInfo">
                    Select a date
                </div>

                <div class="jd-history-chart-wrap">

                    <canvas
                        id="jdHistoryCanvas"
                        width="1000"
                        height="420">
                    </canvas>

                </div>

                <div class="jd-history-stats"
                     id="jdHistoryStats">
                </div>

            </div>
        `;

        document.body.appendChild(modal);

        jdHistoryModal = modal;

        const close =
            jdGet("jdHistoryClose");

        const backdrop =
            modal.querySelector(
                ".jd-history-backdrop"
            );

        if (close) {
            close.addEventListener(
                "click",
                jdCloseHistoryModal
            );
        }

        if (backdrop) {
            backdrop.addEventListener(
                "click",
                jdCloseHistoryModal
            );
        }

        const dateInput =
            jdGet("jdHistoryDate");

        if (dateInput) {

            dateInput.addEventListener(
                "change",
                function () {

                    jdSelectedDate =
                        this.value ||
                        jdLocalDate();

                    jdRenderHistoryGraph();
                }
            );
        }

        const previous =
            jdGet("jdHistoryPrevious");

        if (previous) {

            previous.addEventListener(
                "click",
                function () {

                    jdMoveHistoryDate(-1);

                }
            );
        }

        const next =
            jdGet("jdHistoryNext");

        if (next) {

            next.addEventListener(
                "click",
                function () {

                    jdMoveHistoryDate(1);

                }
            );
        }

        return modal;
    }


    function jdMoveHistoryDate(
        direction
    ) {

        const input =
            jdGet("jdHistoryDate");

        const base =
            new Date(
                (
                    jdSelectedDate ||
                    jdLocalDate()
                ) + "T00:00:00"
            );

        if (
            Number.isNaN(
                base.getTime()
            )
        ) {
            return;
        }

        base.setDate(
            base.getDate() +
            direction
        );

        jdSelectedDate =
            jdLocalDate(base);

        if (input) {
            input.value =
                jdSelectedDate;
        }

        jdRenderHistoryGraph();
    }


    function jdOpenHistoryModal(
        sensorType
    ) {

        jdSelectedSensor =
            sensorType;

        jdSelectedDate =
            jdLocalDate();

        const modal =
            jdCreateHistoryModal();
        
        modal.style.display = "";

        modal.classList.add(
            "jd-history-open"
        );

        document.body.classList.add(
            "jd-history-modal-open"
        );

        const input =
            jdGet("jdHistoryDate");

        if (input) {
            input.value =
                jdSelectedDate;
        }

        jdRenderHistoryGraph();
    }


   function jdCloseHistoryModal() {

    if (!jdHistoryModal) {
        return;
    }

    jdHistoryModal.classList.remove(
        "jd-history-open"
    );

    document.body.classList.remove(
        "jd-history-modal-open"
    );

    jdHistoryModal.style.display = "none";
}


    /* =====================================================
       7. HISTORY GRAPH DRAWING
       ===================================================== */

    function jdSensorConfig(
        type
    ) {

        const configs = {

            ph: {
                title: "pH Historical Graph",
                unit: "pH",
                decimals: 2
            },

            turbidity: {
                title: "Turbidity Historical Graph",
                unit: "NTU",
                decimals: 1
            },

            tds: {
                title: "TDS / EC Historical Graph",
                unit: "ppm",
                decimals: 0
            },

            temperature: {
                title: "Temperature Historical Graph",
                unit: "°C",
                decimals: 1
            },

            waterLevel: {
                title: "Water Level Historical Graph",
                unit: "%",
                decimals: 1
            },

            rainfall: {
                title: "Rainfall Historical Graph",
                unit: "mm",
                decimals: 1
            },

            do: {
                title: "Dissolved Oxygen Historical Graph",
                unit: "mg/L",
                decimals: 2
            }

        };

        return (
            configs[type] ||
            configs.temperature
        );
    }


    function jdRenderHistoryGraph() {

        const config =
            jdSensorConfig(
                jdSelectedSensor
            );

        const history =
            jdLoadStorage(
                JD_SENSOR_HISTORY_KEY
            );
            jdLoadSensorHistoryFromFirestore(
    jdSelectedDate
).then(function (firestoreHistory) {

    if (
        Array.isArray(firestoreHistory) &&
        firestoreHistory.length
    ) {

        jdDrawHistoryCanvas(
            firestoreHistory.filter(function (item) {
                return item[jdSelectedSensor] !== undefined;
            }),
            jdSelectedSensor,
            config
        );

    }

});

       let readings =
    history.filter(function (item) {

        return (
            item.date ===
            jdSelectedDate
        );

    });

jdLoadSensorHistoryFromFirestore(
    jdSelectedDate
).then(function (firestoreHistory) {

    if (
        Array.isArray(firestoreHistory) &&
        firestoreHistory.length
    ) {

        readings =
            firestoreHistory.filter(
                function (item) {

                    return (
                        item[jdSelectedSensor] !==
                        undefined
                    );

                }
            );

        jdRenderHistoryGraphWithReadings(
            readings,
            config
        );
    }

});

        const title =
            jdGet("jdHistoryTitle");

        const subtitle =
            jdGet("jdHistorySubtitle");

        const info =
            jdGet("jdHistoryInfo");

        const stats =
            jdGet("jdHistoryStats");

        if (title) {
            title.textContent =
                config.title;
        }

        if (subtitle) {
            subtitle.textContent =
                jdDisplayDate(
                    jdSelectedDate
                );
        }

        if (info) {

            info.textContent =
                readings.length
                    ? `${readings.length} readings found • ${jdDisplayDate(jdSelectedDate)}`
                    : `No readings available for ${jdDisplayDate(jdSelectedDate)}`;
        }

        jdDrawHistoryCanvas(
            readings,
            jdSelectedSensor,
            config
        );

        if (stats) {

            if (!readings.length) {

                stats.innerHTML =
                    `
                    <div class="jd-stat-box">
                        <span>Readings</span>
                        <strong>0</strong>
                    </div>
                    `;

            } else {

                const values =
                    readings
                        .map(function (item) {
                            return Number(
                                item[
                                    jdSelectedSensor
                                ]
                            );
                        })
                        .filter(Number.isFinite);

                const minimum =
                    Math.min(...values);

                const maximum =
                    Math.max(...values);

                const average =
                    values.reduce(
                        function (sum, value) {
                            return sum + value;
                        },
                        0
                    ) /
                    values.length;

                stats.innerHTML = `

                    <div class="jd-stat-box">
                        <span>Readings</span>
                        <strong>
                            ${values.length}
                        </strong>
                    </div>

                    <div class="jd-stat-box">
                        <span>Minimum</span>
                        <strong>
                            ${minimum.toFixed(
                                config.decimals
                            )}
                            ${config.unit}
                        </strong>
                    </div>

                    <div class="jd-stat-box">
                        <span>Average</span>
                        <strong>
                            ${average.toFixed(
                                config.decimals
                            )}
                            ${config.unit}
                        </strong>
                    </div>

                    <div class="jd-stat-box">
                        <span>Maximum</span>
                        <strong>
                            ${maximum.toFixed(
                                config.decimals
                            )}
                            ${config.unit}
                        </strong>
                    </div>
                `;
            }
        }
    }
function jdRenderHistoryGraphWithReadings(
    readings,
    config
) {

    const title =
        jdGet("jdHistoryTitle");

    const subtitle =
        jdGet("jdHistorySubtitle");

    const info =
        jdGet("jdHistoryInfo");

    const stats =
        jdGet("jdHistoryStats");


    if (title) {

        title.textContent =
            config.title;

    }


    if (subtitle) {

        subtitle.textContent =
            jdDisplayDate(
                jdSelectedDate
            );

    }


    if (info) {

        info.textContent =
            readings.length
                ? `${readings.length} readings found • ${jdDisplayDate(jdSelectedDate)}`
                : `No readings available for ${jdDisplayDate(jdSelectedDate)}`;

    }


    jdDrawHistoryCanvas(
        readings,
        jdSelectedSensor,
        config
    );


    if (stats) {

        if (!readings.length) {

            stats.innerHTML =
                `
                <div class="jd-stat-box">
                    <span>Readings</span>
                    <strong>0</strong>
                </div>
                `;

        } else {

            const values =
                readings
                    .map(function (item) {

                        return Number(
                            item[
                                jdSelectedSensor
                            ]
                        );

                    })
                    .filter(
                        Number.isFinite
                    );


            if (!values.length) {

                stats.innerHTML =
                    `
                    <div class="jd-stat-box">
                        <span>Readings</span>
                        <strong>0</strong>
                    </div>
                    `;

                return;
            }


            const minimum =
                Math.min(...values);


            const maximum =
                Math.max(...values);


            const average =
                values.reduce(
                    function (
                        sum,
                        value
                    ) {

                        return (
                            sum +
                            value
                        );

                    },
                    0
                ) /
                values.length;


            stats.innerHTML = `

                <div class="jd-stat-box">
                    <span>Readings</span>
                    <strong>
                        ${values.length}
                    </strong>
                </div>

                <div class="jd-stat-box">
                    <span>Minimum</span>
                    <strong>
                        ${minimum.toFixed(
                            config.decimals
                        )}
                        ${config.unit}
                    </strong>
                </div>

                <div class="jd-stat-box">
                    <span>Average</span>
                    <strong>
                        ${average.toFixed(
                            config.decimals
                        )}
                        ${config.unit}
                    </strong>
                </div>

                <div class="jd-stat-box">
                    <span>Maximum</span>
                    <strong>
                        ${maximum.toFixed(
                            config.decimals
                        )}
                        ${config.unit}
                    </strong>
                `;

        }

    }

}

    function jdDrawHistoryCanvas(
        readings,
        type,
        config
    ) {

        const canvas =
            jdGet("jdHistoryCanvas");

        if (!canvas) {
            return;
        }

        const context =
            canvas.getContext("2d");

        if (!context) {
            return;
        }

        const rect =
            canvas.getBoundingClientRect();

        const width =
            Math.max(
                700,
                Math.floor(
                    rect.width ||
                    1000
                )
            );

        const height =
            420;

        const dpr =
            window.devicePixelRatio ||
            1;

        canvas.width =
            width * dpr;

        canvas.height =
            height * dpr;

        canvas.style.height =
            height + "px";

        context.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );

        context.clearRect(
            0,
            0,
            width,
            height
        );

        /*
         * Read current theme from the document.
         * We intentionally do not modify the existing
         * website colors/design.
         */

        const light =
            document.documentElement
                .classList
                .contains("light-theme");

        const textColor =
            light
                ? "#263238"
                : "#dce7ef";

        const gridColor =
            light
                ? "rgba(30,60,80,.12)"
                : "rgba(180,210,225,.14)";

        const lineColor =
            light
                ? "#1976d2"
                : "#4fc3f7";

        const fillColor =
            light
                ? "rgba(25,118,210,.12)"
                : "rgba(79,195,247,.10)";

        const left =
            65;

        const right =
            25;

        const top =
            30;

        const bottom =
            55;

        const chartWidth =
            width -
            left -
            right;

        const chartHeight =
            height -
            top -
            bottom;


        /* ================= EMPTY ================= */

        if (!readings.length) {

            context.fillStyle =
                textColor;

            context.font =
                "16px Arial";

            context.textAlign =
                "center";

            context.textBaseline =
                "middle";

            context.fillText(
                "No historical readings available for this date",
                width / 2,
                height / 2
            );

            return;
        }


        /* ================= VALUES ================= */

        const values =
            readings
                .map(function (item) {
                    return Number(
                        item[type]
                    );
                })
                .filter(
                    Number.isFinite
                );

        if (!values.length) {
            return;
        }

        let minimum =
            Math.min(...values);

        let maximum =
            Math.max(...values);

        if (
            minimum === maximum
        ) {

            minimum -= 1;
            maximum += 1;
        }

        const padding =
            (
                maximum -
                minimum
            ) * 0.12;

        minimum -= padding;
        maximum += padding;


        /* ================= GRID ================= */

        context.strokeStyle =
            gridColor;

        context.lineWidth =
            1;

        context.font =
            "11px Arial";

        context.fillStyle =
            textColor;

        context.textAlign =
            "right";

        context.textBaseline =
            "middle";

        const gridLines =
            5;

        for (
            let i = 0;
            i <= gridLines;
            i++
        ) {

            const ratio =
                i / gridLines;

            const y =
                top +
                chartHeight *
                ratio;

            context.beginPath();

            context.moveTo(
                left,
                y
            );

            context.lineTo(
                width - right,
                y
            );

            context.stroke();

            const value =
                maximum -
                (
                    maximum -
                    minimum
                ) * ratio;

            context.fillText(
                value.toFixed(
                    config.decimals
                ),
                left - 10,
                y
            );
        }


        /* ================= X LABELS ================= */

        context.textAlign =
            "center";

        context.textBaseline =
            "top";

        const labelStep =
            Math.max(
                1,
                Math.ceil(
                    readings.length /
                    6
                )
            );

        readings.forEach(
            function (item, index) {

                if (
                    index % labelStep !== 0 &&
                    index !==
                        readings.length - 1
                ) {
                    return;
                }

                const x =
                    readings.length === 1
                        ? left +
                          chartWidth / 2
                        : left +
                          (
                              index /
                              (
                                  readings.length -
                                  1
                              )
                          ) *
                          chartWidth;

                const label =
                    item.time ||
                    "";

                context.fillText(
                    label,
                    x,
                    height - bottom + 12
                );
            }
        );


        /* ================= AREA ================= */

        const points =
            readings.map(
                function (item, index) {

                    const value =
                        Number(
                            item[type]
                        );

                    const ratio =
                        (
                            value -
                            minimum
                        ) /
                        (
                            maximum -
                            minimum
                        );

                    const x =
                        readings.length === 1
                            ? left +
                              chartWidth / 2
                            : left +
                              (
                                  index /
                                  (
                                      readings.length -
                                      1
                                  )
                              ) *
                              chartWidth;

                    const y =
                        top +
                        chartHeight -
                        ratio *
                        chartHeight;

                    return {
                        x: x,
                        y: y
                    };
                }
            );

        if (!points.length) {
            return;
        }


        /* Area */

        context.beginPath();

        context.moveTo(
            points[0].x,
            top +
            chartHeight
        );

        points.forEach(
            function (point) {

                context.lineTo(
                    point.x,
                    point.y
                );

            }
        );

        context.lineTo(
            points[
                points.length - 1
            ].x,
            top +
            chartHeight
        );

        context.closePath();

        context.fillStyle =
            fillColor;

        context.fill();


        /* Line */

        context.beginPath();

        points.forEach(
            function (point, index) {

                if (index === 0) {

                    context.moveTo(
                        point.x,
                        point.y
                    );

                } else {

                    context.lineTo(
                        point.x,
                        point.y
                    );
                }
            }
        );

        context.strokeStyle =
            lineColor;

        context.lineWidth =
            2.5;

        context.stroke();


        /* Points */

        context.fillStyle =
            lineColor;

        points.forEach(
            function (point) {

                context.beginPath();

                context.arc(
                    point.x,
                    point.y,
                    3.5,
                    0,
                    Math.PI * 2
                );

                context.fill();
            }
        );


        /* Axis labels */

        context.fillStyle =
            textColor;

        context.font =
            "12px Arial";

        context.textAlign =
            "center";

        context.fillText(
            config.unit,
            width / 2,
            8
        );
    }


    /* =====================================================
       8. SENSOR CARD CLICK
       ===================================================== */

    function jdMakeSensorCardsClickable() {

        const sensorCards = {
            "card-ph": "ph",
            "card-turbidity": "turbidity",
            "card-tds": "tds",
            "card-temperature": "temperature",
            "card-waterLevel": "waterLevel",
            "card-rainfall": "rainfall",
            "card-do": "do"
        };

        Object.keys(
            sensorCards
        ).forEach(function (cardId) {

            const card =
                jdGet(cardId);

            if (!card) {
                return;
            }

            if (
                card.dataset
                    .jdHistoryClickable === "1"
            ) {
                return;
            }

            card.dataset
                .jdHistoryClickable = "1";

            card.style.cursor =
                "pointer";

            card.addEventListener(
                "click",
                function (event) {

                    /*
                     * Don't open the history graph when
                     * clicking an actual button/input
                     * inside a card.
                     */

                    const target =
                        event.target;

                    if (
                        target &&
                        (
                            target.closest(
                                "button"
                            ) ||
                            target.closest(
                                "input"
                            ) ||
                            target.closest(
                                "select"
                            ) ||
                            target.closest(
                                "a"
                            )
                        )
                    ) {
                        return;
                    }

                    jdOpenHistoryModal(
                        sensorCards[cardId]
                    );
                }
            );

        });
    }


    /* =====================================================
       9. CAPTURE LIVE DATA WITHOUT BREAKING EXISTING CODE
       ===================================================== */

    function jdPatchFirebaseMapping() {

        /*
         * The original Firebase function maps the main
         * hardware values. This wrapper additionally maps
         * pH and dissolved oxygen when Firebase provides
         * those keys.
         */

        if (
            typeof applyLiveFirebaseData !==
            "function"
        ) {
            return;
        }

        if (
            applyLiveFirebaseData
                .__jdPatched === true
        ) {
            return;
        }

        const original =
            applyLiveFirebaseData;

        function patched(data) {

            try {

                if (
                    data &&
                    typeof data === "object" &&
                    typeof sensors !== "undefined"
                ) {

                    const phValue =
                        data.ph ??
                        data.pH ??
                        data.PH;
if (phValue !== undefined) {
    window.liveSensorData.ph = Number(phValue);
}
                    const doValue =
                        data.do ??
                        data.DO ??
                        data.dissolvedOxygen ??
                        data.dissolved_oxygen;

                    if (
                        phValue !== undefined &&
                        Number.isFinite(
                            Number(phValue)
                        )
                    ) {
                        sensors.ph =
                            Number(phValue);
                    }

                    if (
                        doValue !== undefined &&
                        Number.isFinite(
                            Number(doValue)
                        )
                    ) {
                        sensors.do =
                            Number(doValue);
                    }
                }

            } catch (error) {

                console.warn(
                    "pH/DO mapping warning:",
                    error
                );
            }

            return original.apply(
                this,
                arguments
            );
        }

        patched.__jdPatched =
            true;

        /*
         * Replace the global function reference.
         */
        try {

            window.applyLiveFirebaseData =
                patched;

        } catch (error) {

            console.warn(
                "Firebase wrapper could not be attached"
            );
        }
    }


    /* =====================================================
       10. UPDATE HOOK
       ===================================================== */

    function jdInstallDashboardHook() {

        if (
            typeof updateDashboard !==
            "function"
        ) {
            return;
        }

        if (
            updateDashboard
                .__jdPatched === true
        ) {
            return;
        }

        const original =
            updateDashboard;

        function patchedDashboard() {

            /*
             * Save values BEFORE the original dashboard
             * function changes previousSensorValues.
             */

            const before =
                jdReadSensors();

            if (before) {

                Object.keys(before)
                    .forEach(
                        function (key) {

                            if (
                                jdPreviousValues[
                                    key
                                ] === undefined
                            ) {
                                jdPreviousValues[
                                    key
                                ] =
                                    before[key];
                            }
                        }
                    );
            }

            const result =
                original.apply(
                    this,
                    arguments
                );

            const current =
                jdReadSensors();

            if (
                before &&
                current
            ) {

                /*
                 * On the first run, use stable.
                 * On later runs, show actual direction.
                 */

                const hasPrevious =
                    Object.keys(
                        jdPreviousValues
                    ).length > 0;

                if (hasPrevious) {

                    jdUpdateTrendLabels(
                        jdPreviousValues,
                        current
                    );
                }

                Object.keys(current)
                    .forEach(
                        function (key) {

                            jdPreviousValues[
                                key
                            ] =
                                current[key];

                        }
                    );

                jdCaptureSensorHistory();
            }

            /*
             * Keep sensor cards clickable even when
             * dashboard sections are dynamically updated.
             */

            jdMakeSensorCardsClickable();

            return result;
        }

        patchedDashboard.__jdPatched =
            true;

        try {

            window.updateDashboard =
                patchedDashboard;

        } catch (error) {

            console.warn(
                "Dashboard hook unavailable"
            );
        }
    }


    /* =====================================================
       11. KEYBOARD ESCAPE
       ===================================================== */

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" &&
                jdHistoryModal &&
                jdHistoryModal.classList
                    .contains(
                        "jd-history-open"
                    )
            ) {
                jdCloseHistoryModal();
            }

        }
    );


    /* =====================================================
       12. INITIALIZATION
       ===================================================== */

    function jdInitializePart1() {

        jdInitializeTheme();

        jdInitializeFullscreen();

        jdPatchFirebaseMapping();

        jdInstallDashboardHook();

        jdMakeSensorCardsClickable();

        /*
         * Initial history capture.
         */
        setTimeout(
            function () {

                const current =
                    jdReadSensors();

                if (current) {

                    Object.keys(current)
                        .forEach(
                            function (key) {

                                jdPreviousValues[
                                    key
                                ] =
                                    current[key];

                            }
                        );
                }

            },
            500
        );
    }


    /*
     * The original script is loaded after Firebase.
     * Therefore wait until DOM is ready.
     */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            jdInitializePart1,
            {
                once: true
            }
        );

    } else {

        jdInitializePart1();
    }


    /* =====================================================
       13. PUBLIC ACCESS FOR PART 2 / PART 3
       ===================================================== */

    window.JAL_DRISHTI_FINAL_PATCH =
        window.JAL_DRISHTI_FINAL_PATCH ||
        {};

    window.JAL_DRISHTI_FINAL_PATCH.part1 = {
        openHistory: jdOpenHistoryModal,
        closeHistory: jdCloseHistoryModal,
        captureHistory: jdCaptureSensorHistory,
        refreshTrends: function () {

            const current =
                jdReadSensors();

            if (
                current &&
                Object.keys(
                    jdPreviousValues
                ).length
            ) {

                jdUpdateTrendLabels(
                    jdPreviousValues,
                    current
                );
            }
        }
    };

})();
/* =========================================================
   JAL-DRISHTI AI | FINAL FUNCTIONALITY PATCH
   PART 2 / 3
   ---------------------------------------------------------
   Adds:
   1. Live AI Water Fingerprint
   2. Live Smart Alert System
   3. Water Risk Trend
   4. Historical Risk
   5. Historical Risk Calendar / Date Filter
   6. Continuous refresh with live sensor values
   ========================================================= */

(function () {
    "use strict";

    /* =====================================================
       BASIC HELPERS
       ===================================================== */

    function p2Get(id) {
        return document.getElementById(id);
    }

    function p2Num(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n)
            ? n
            : fallback;
    }

    function p2Clamp(value, min, max) {
        return Math.min(
            Math.max(value, min),
            max
        );
    }

    function p2DateKey(date = new Date()) {

        const d =
            date instanceof Date
                ? date
                : new Date(date);

        if (
            Number.isNaN(
                d.getTime()
            )
        ) {
            return "";
        }

        return [
            d.getFullYear(),
            String(
                d.getMonth() + 1
            ).padStart(2, "0"),
            String(
                d.getDate()
            ).padStart(2, "0")
        ].join("-");
    }

    function p2DisplayDate(key) {

        if (!key) {
            return "--";
        }

        const d =
            new Date(
                key + "T00:00:00"
            );

        if (
            Number.isNaN(
                d.getTime()
            )
        ) {
            return key;
        }

        return d.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
    }

    function p2Load(key) {

        try {

            const raw =
                localStorage.getItem(key);

            if (!raw) {
                return [];
            }

            const data =
                JSON.parse(raw);

            return Array.isArray(data)
                ? data
                : [];

        } catch (error) {

            console.warn(
                "JAL-DRISHTI storage read error:",
                error
            );

            return [];
        }
    }

    function p2Save(
        key,
        data
    ) {

        try {

            localStorage.setItem(
                key,
                JSON.stringify(data)
            );

            return true;

        } catch (error) {

            console.warn(
                "JAL-DRISHTI storage save error:",
                error
            );

            return false;
        }
    }


    /* =====================================================
       SENSOR ACCESS
       ===================================================== */

    function p2Sensors() {

       const sensors =
    window.liveSensorData;

if (!sensors) {
    return null;
}

        return {
            ph: p2Num(
                sensors.ph
            ),

            turbidity: p2Num(
                sensors.turbidity
            ),

            tds: p2Num(
                sensors.tds
            ),

            temperature: p2Num(
                sensors.temperature
            ),

            waterLevel: p2Num(
                sensors.waterLevel
            ),

            rainfall: p2Num(
                sensors.rainfall
            ),

            do: p2Num(
                sensors.do
            )
        };
    }


    /* =====================================================
       1. AI WATER FINGERPRINT
       ===================================================== */

    function p2FingerprintScores() {

        const s =
            p2Sensors();

        if (!s) {
            return null;
        }

        const scores = {

            ph: p2Clamp(
                100 -
                Math.abs(
                    s.ph - 7
                ) * 25,
                0,
                100
            ),

            turbidity: p2Clamp(
                100 -
                s.turbidity * 1.5,
                0,
                100
            ),

            tds: p2Clamp(
                100 -
                Math.max(
                    0,
                    s.tds - 300
                ) * 0.15,
                0,
                100
            ),

            temperature: p2Clamp(
                100 -
                Math.abs(
                    s.temperature - 25
                ) * 5,
                0,
                100
            ),

            do: p2Clamp(
                s.do * 12,
                0,
                100
            )
        };

        Object.keys(
            scores
        ).forEach(
            function (key) {

                scores[key] =
                    Math.round(
                        scores[key]
                    );
            }
        );

        return scores;
    }


    function p2FingerprintStatus(
        score
    ) {

        if (score >= 80) {
            return "Good";
        }

        if (score >= 60) {
            return "Moderate";
        }

        if (score >= 40) {
            return "Warning";
        }

        return "Critical";
    }


    function p2UpdateFingerprint() {

        const scores =
            p2FingerprintScores();

        const s =
            p2Sensors();

        if (
            !scores ||
            !s
        ) {
            return;
        }

        const mapping = {

            ph: {
                bar:
                    "phFingerprint",
                value:
                    "phFingerprintValue"
            },

            turbidity: {
                bar:
                    "turbidityFingerprint",
                value:
                    "turbidityFingerprintValue"
            },

            tds: {
                bar:
                    "tdsFingerprint",
                value:
                    "tdsFingerprintValue"
            },

            temperature: {
                bar:
                    "temperatureFingerprint",
                value:
                    "temperatureFingerprintValue"
            },

            do: {
                bar:
                    "doFingerprint",
                value:
                    "doFingerprintValue"
            }
        };


        Object.keys(
            mapping
        ).forEach(
            function (key) {

                const bar =
                    p2Get(
                        mapping[key].bar
                    );

                const value =
                    p2Get(
                        mapping[key].value
                    );

                const score =
                    scores[key];

                if (bar) {

                    /*
                     * Keep existing design.
                     * Only update the live width.
                     */

                    bar.style.width =
                        score + "%";

                    bar.setAttribute(
                        "aria-valuenow",
                        String(score)
                    );

                }

                if (value) {

                    if (key === "ph") {
    value.textContent = s.ph.toFixed(2);
}

if (key === "turbidity") {
    value.textContent = s.turbidity.toFixed(0) + " NTU";
}

if (key === "tds") {
    value.textContent = s.tds.toFixed(0) + " ppm";
}

if (key === "temperature") {
    value.textContent = s.temperature.toFixed(2) + " °C";
}

if (key === "do") {
    value.textContent = s.do.toFixed(2) + " mg/L";
}

                }
            }
        );


        /* Overall fingerprint */

        const total =
            Math.round(
                (
                    scores.ph +
                    scores.turbidity +
                    scores.tds +
                    scores.temperature +
                    scores.do
                ) / 5
            );


        const message =
            p2Get(
                "fingerprintMessage"
            );

        if (message) {

            let status =
                p2FingerprintStatus(
                    total
                );

            let text =
                "";

            if (
                status === "Good"
            ) {

                text =
                    "AI Water Fingerprint: Water quality parameters are currently within a good range.";

            } else if (
                status === "Moderate"
            ) {

                text =
                    "AI Water Fingerprint: Water quality is moderate. Continue monitoring the sensor network.";

            } else if (
                status === "Warning"
            ) {

                text =
                    "AI Water Fingerprint: One or more water parameters require attention.";

            } else {

                text =
                    "AI Water Fingerprint: Critical water-quality conditions detected. Immediate inspection is recommended.";

            }

            message.textContent =
                text;
        }
    }


    /* =====================================================
       2. SMART ALERT SYSTEM
       ===================================================== */

    function p2Status(
        type,
        value
    ) {

        const v =
            p2Num(value);

        if (type === "ph") {

            if (
                v < 6.5 ||
                v > 8.5
            ) {
                return "Critical";
            }

            if (
                v < 6.8 ||
                v > 8.2
            ) {
                return "Warning";
            }

            return "Normal";
        }


        if (
            type === "turbidity"
        ) {

            if (v > 1500) {
                return "Critical";
            }

            if (v > 800) {
                return "Warning";
            }

            return "Normal";
        }


        if (type === "tds") {

            if (v > 2500) {
                return "Critical";
            }

            if (v > 1000) {
                return "Warning";
            }

            return "Normal";
        }


        if (
            type === "temperature"
        ) {

            if (
                v < 15 ||
                v > 40
            ) {
                return "Critical";
            }

            if (
                v < 20 ||
                v > 35
            ) {
                return "Warning";
            }

            return "Normal";
        }


        if (
            type === "waterLevel"
        ) {

            if (
                v > 90 ||
                v < 15
            ) {
                return "Critical";
            }

            if (
                v > 80 ||
                v < 25
            ) {
                return "Warning";
            }

            return "Normal";
        }


        if (
            type === "rainfall"
        ) {

            if (v > 40) {
                return "Critical";
            }

            if (v > 15) {
                return "Warning";
            }

            return "Normal";
        }


        if (type === "do") {

            if (v < 4) {
                return "Critical";
            }

            if (v < 5.5) {
                return "Warning";
            }

            return "Normal";
        }


        return "Normal";
    }


    function p2AlertReason(
        type,
        value,
        status
    ) {

        const v =
            p2Num(value);

        if (
            status === "Normal"
        ) {
            return "";
        }


        if (
            type === "ph"
        ) {

            return status === "Critical"
                ? `pH level is critically abnormal (${v.toFixed(2)})`
                : `pH level is outside the preferred range (${v.toFixed(2)})`;
        }


        if (
            type === "turbidity"
        ) {

            return status === "Critical"
                ? `Turbidity level is critically high (${v.toFixed(1)} NTU)`
                : `Turbidity level is high (${v.toFixed(1)} NTU)`;
        }


        if (
            type === "tds"
        ) {

            return status === "Critical"
                ? `TDS level is critically high (${v.toFixed(0)} ppm)`
                : `TDS level is high (${v.toFixed(0)} ppm)`;
        }


        if (
            type === "temperature"
        ) {

            return status === "Critical"
                ? `Water temperature is critically abnormal (${v.toFixed(1)} °C)`
                : `Water temperature needs attention (${v.toFixed(1)} °C)`;
        }


        if (
            type === "waterLevel"
        ) {

            return status === "Critical"
                ? `Water level is critically abnormal (${v.toFixed(1)}%)`
                : `Water level requires attention (${v.toFixed(1)}%)`;
        }


        if (
            type === "rainfall"
        ) {

            return status === "Critical"
                ? `Rainfall intensity is critically high (${v.toFixed(1)} mm)`
                : `Rainfall level is high (${v.toFixed(1)} mm)`;
        }


        if (
            type === "do"
        ) {

            return status === "Critical"
                ? `Dissolved oxygen is critically low (${v.toFixed(2)} mg/L)`
                : `Dissolved oxygen is low (${v.toFixed(2)} mg/L)`;
        }


        return "Sensor parameter requires attention.";
    }


    function p2Action(
        type,
        status
    ) {

        if (
            status === "Critical"
        ) {

            if (
                type === "turbidity"
            ) {
                return "Immediate inspection and water-quality testing recommended.";
            }

            if (
                type === "tds"
            ) {
                return "Immediate inspection and TDS/source verification recommended.";
            }

            if (
                type === "do"
            ) {
                return "Immediate inspection and dissolved-oxygen verification recommended.";
            }

            if (
                type === "temperature"
            ) {
                return "Immediate inspection of the water source and sensor recommended.";
            }

            return "Immediate inspection recommended.";
        }


        return "Continue monitoring and inspect if the condition persists.";
    }


    function p2BuildAlerts() {

        const s =
            p2Sensors();

        if (!s) {
            return [];
        }

        const definitions = [

            {
                key: "ph",
                label: "pH",
                value: s.ph,
                unit: ""
            },

            {
                key: "turbidity",
                label: "Turbidity",
                value: s.turbidity,
                unit: " NTU"
            },

            {
                key: "tds",
                label: "TDS",
                value: s.tds,
                unit: " ppm"
            },

            {
                key: "temperature",
                label: "Water Temperature",
                value: s.temperature,
                unit: " °C"
            },

            {
                key: "waterLevel",
                label: "Water Level",
                value: s.waterLevel,
                unit: " %"
            },

            {
                key: "rainfall",
                label: "Rainfall",
                value: s.rainfall,
                unit: " mm"
            },

            {
                key: "do",
                label: "Dissolved Oxygen",
                value: s.do,
                unit: " mg/L"
            }
        ];


        return definitions
            .map(
                function (item) {

                    const status =
                        p2Status(
                            item.key,
                            item.value
                        );

                    return {
                        ...item,
                        status:
                            status,
                        reason:
                            p2AlertReason(
                                item.key,
                                item.value,
                                status
                            ),
                        action:
                            p2Action(
                                item.key,
                                status
                            )
                    };
                }
            )
            .filter(
                function (item) {

                    return (
                        item.status !==
                        "Normal"
                    );
                }
            )
            .sort(
                function (a, b) {

                    const priority = {
                        Critical: 3,
                        Warning: 2,
                        Normal: 1
                    };

                    return (
                        priority[b.status] -
                        priority[a.status]
                    );
                }
            );
    }


    function p2UpdateSmartAlerts() {

        const alerts =
            p2BuildAlerts();

        const critical =
            alerts.filter(
                function (a) {
                    return (
                        a.status ===
                        "Critical"
                    );
                }
            ).length;

        const warning =
            alerts.filter(
                function (a) {
                    return (
                        a.status ===
                        "Warning"
                    );
                }
            ).length;


        /*
         * Normal count means all monitored
         * parameters currently normal.
         */

        const totalSensors = 7;

        const normal =
            Math.max(
                0,
                totalSensors -
                critical -
                warning
            );


        const criticalEl =
            p2Get(
                "criticalCount"
            );

        const warningEl =
            p2Get(
                "warningCount"
            );

        const normalEl =
            p2Get(
                "normalCount"
            );


        if (criticalEl) {
            criticalEl.textContent =
                String(critical);
        }

        if (warningEl) {
            warningEl.textContent =
                String(warning);
        }

        if (normalEl) {
            normalEl.textContent =
                String(normal);
        }


        const list =
            p2Get(
                "smartAlertList"
            );

        if (!list) {
            return;
        }


        if (!alerts.length) {

            list.innerHTML = `
                <div class="jd-live-alert-empty">
                    <div class="jd-live-alert-icon">
                        ✓
                    </div>

                    <div>
                        <strong>
                            All sensors normal
                        </strong>

                        <span>
                            No active water-quality alerts detected.
                        </span>
                    </div>
                </div>
            `;

            return;
        }


        list.innerHTML =
            alerts
                .map(
                    function (alert) {

                        const statusClass =
                            alert.status
                                .toLowerCase();

                        const icon =
                            alert.status ===
                            "Critical"
                                ? "🚨"
                                : "⚠️";

                        return `

                            <div class="
                                jd-live-alert
                                ${statusClass}
                            ">

                                <div class="
                                    jd-live-alert-icon
                                ">
                                    ${icon}
                                </div>

                                <div class="
                                    jd-live-alert-content
                                ">

                                    <div class="
                                        jd-live-alert-top
                                    ">

                                        <strong>
                                            ${alert.label}
                                        </strong>

                                        <span class="
                                            jd-live-alert-status
                                            ${statusClass}
                                        ">
                                            ${alert.status.toUpperCase()}
                                        </span>

                                    </div>

                                    <div class="
                                        jd-live-alert-value
                                    ">
                                        Current reading:
                                        ${alert.value}${alert.unit}
                                    </div>

                                    <div class="
                                        jd-live-alert-reason
                                    ">
                                        ${alert.reason}
                                    </div>

                                    <div class="
                                        jd-live-alert-action
                                    ">
                                        🛠️
                                        ${alert.action}
                                    </div>

                                </div>

                            </div>
                        `;
                    }
                )
                .join("");
    }


    /* =====================================================
       3. WATER RISK TREND
       ===================================================== */

    function p2RiskValue() {

        const s =
            p2Sensors();

        if (!s) {
            return 0;
        }

        try {

            if (
                typeof calculateRisk ===
                "function"
            ) {

                const value =
                    Number(
                        calculateRisk()
                    );

                if (
                    Number.isFinite(
                        value
                    )
                ) {
                    return p2Clamp(
                        Math.round(value),
                        0,
                        100
                    );
                }
            }

        } catch (error) {

            console.warn(
                "Risk calculation fallback"
            );
        }


        let risk = 0;


        if (
            s.ph < 6.5 ||
            s.ph > 8.5
        ) {
            risk += 22;

        } else if (
            s.ph < 6.8 ||
            s.ph > 8.2
        ) {
            risk += 8;
        }


        if (
            s.turbidity > 1500
        ) {
            risk += 25;

        } else if (
            s.turbidity > 800
        ) {
            risk += 12;
        }


        if (
            s.tds > 2500
        ) {
            risk += 20;

        } else if (
            s.tds > 1000
        ) {
            risk += 10;
        }


        if (
            s.temperature < 15 ||
            s.temperature > 40
        ) {
            risk += 12;

        } else if (
            s.temperature < 20 ||
            s.temperature > 35
        ) {
            risk += 5;
        }


        if (
            s.waterLevel > 90 ||
            s.waterLevel < 15
        ) {
            risk += 15;

        } else if (
            s.waterLevel > 80 ||
            s.waterLevel < 25
        ) {
            risk += 7;
        }


        if (
            s.rainfall > 40
        ) {
            risk += 12;

        } else if (
            s.rainfall > 15
        ) {
            risk += 5;
        }


        if (
            s.do < 4
        ) {
            risk += 20;

        } else if (
            s.do < 5.5
        ) {
            risk += 10;
        }


        return p2Clamp(
            Math.round(risk),
            0,
            100
        );
    }


    function p2RiskHistory() {

        return p2Load(
            "jalDrishtiExtendedRiskHistory"
        );
    }


    function p2RiskStatus(
        value
    ) {

        const v =
            p2Num(value);

        if (v >= 70) {
            return "Critical";
        }

        if (v >= 40) {
            return "Warning";
        }

        return "Normal";
    }


    function p2DrawRiskTrend() {

        const canvas =
            p2Get(
                "waterChart"
            );

        if (!canvas) {
            return;
        }


        const history =
            p2RiskHistory();


        /*
         * Use the latest 200 records.
         */

        const records =
            history
                .slice(-200);


        const context =
            canvas.getContext(
                "2d"
            );

        if (!context) {
            return;
        }


        const rect =
            canvas.getBoundingClientRect();

        const width =
            Math.max(
                700,
                Math.floor(
                    rect.width ||
                    900
                )
            );

        const height =
            Math.max(
                300,
                Math.floor(
                    rect.height ||
                    360
                )
            );

        const dpr =
            window.devicePixelRatio ||
            1;


        canvas.width =
            width * dpr;

        canvas.height =
            height * dpr;

        canvas.style.height =
            height + "px";


        context.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );


        context.clearRect(
            0,
            0,
            width,
            height
        );


        const light =
            document.documentElement
                .classList
                .contains(
                    "light-theme"
                );


        const text =
            light
                ? "#263238"
                : "#dce7ef";

        const grid =
            light
                ? "rgba(30,60,80,.12)"
                : "rgba(180,210,225,.14)";

        const line =
            light
                ? "#1976d2"
                : "#4fc3f7";


        const left =
            55;

        const right =
            25;

        const top =
            25;

        const bottom =
            45;


        const chartWidth =
            width -
            left -
            right;

        const chartHeight =
            height -
            top -
            bottom;


        /*
         * If no data is available, show a useful
         * empty state instead of a broken graph.
         */

        if (!records.length) {

            context.fillStyle =
                text;

            context.font =
                "15px Arial";

            context.textAlign =
                "center";

            context.textBaseline =
                "middle";

            context.fillText(
                "Waiting for live water-risk readings...",
                width / 2,
                height / 2
            );

            return;
        }


        /* ================= GRID ================= */

        context.strokeStyle =
            grid;

        context.lineWidth =
            1;


        for (
            let i = 0;
            i <= 5;
            i++
        ) {

            const ratio =
                i / 5;

            const y =
                top +
                chartHeight *
                ratio;


            context.beginPath();

            context.moveTo(
                left,
                y
            );

            context.lineTo(
                width - right,
                y
            );

            context.stroke();


            context.fillStyle =
                text;

            context.font =
                "11px Arial";

            context.textAlign =
                "right";

            context.textBaseline =
                "middle";

            const value =
                100 -
                ratio * 100;

            context.fillText(
                String(
                    Math.round(value)
                ),
                left - 9,
                y
            );
        }


        /* ================= RISK POINTS ================= */

        const points =
            records.map(
                function (
                    record,
                    index
                ) {

                    const risk =
                        p2Clamp(
                            p2Num(
                                record.risk
                            ),
                            0,
                            100
                        );


                    const x =
                        records.length === 1
                            ? left +
                              chartWidth / 2
                            : left +
                              (
                                  index /
                                  (
                                      records.length -
                                      1
                                  )
                              ) *
                              chartWidth;


                    const y =
                        top +
                        chartHeight -
                        (
                            risk /
                            100
                        ) *
                        chartHeight;


                    return {
                        x: x,
                        y: y,
                        risk: risk
                    };
                }
            );


        /* ================= LINE ================= */

        context.beginPath();


        points.forEach(
            function (
                point,
                index
            ) {

                if (
                    index === 0
                ) {

                    context.moveTo(
                        point.x,
                        point.y
                    );

                } else {

                    context.lineTo(
                        point.x,
                        point.y
                    );
                }
            }
        );


        context.strokeStyle =
            line;

        context.lineWidth =
            2.5;

        context.stroke();


        /* ================= POINTS ================= */

        context.fillStyle =
            line;


        points.forEach(
            function (
                point
            ) {

                context.beginPath();

                context.arc(
                    point.x,
                    point.y,
                    3,
                    0,
                    Math.PI * 2
                );

                context.fill();
            }
        );


        /* ================= X AXIS ================= */

        context.fillStyle =
            text;

        context.font =
            "10px Arial";

        context.textAlign =
            "center";

        context.textBaseline =
            "top";


        const step =
            Math.max(
                1,
                Math.ceil(
                    records.length /
                    6
                )
            );


        records.forEach(
            function (
                record,
                index
            ) {

                if (
                    index % step !== 0 &&
                    index !==
                        records.length - 1
                ) {
                    return;
                }


                const point =
                    points[index];

                const label =
                    record.time ||
                    "";


                context.fillText(
                    label,
                    point.x,
                    height -
                    bottom +
                    10
                );
            }
        );
    }


    /* =====================================================
       4. HISTORICAL RISK SECTION
       ===================================================== */

    let p2HistoricalDate =
        p2DateKey();


    function p2CreateHistoricalRiskUI() {

        const container =
            p2Get(
                "historicalRiskContainer"
            );

        if (!container) {
            return;
        }


        /*
         * Do not recreate the UI every refresh.
         */

        if (
            container.dataset
                .jdHistoricalReady === "1"
        ) {
            return;
        }


        container.dataset
            .jdHistoricalReady = "1";


        container.innerHTML = `

            <div class="
                jd-historical-risk-panel
            ">

                <div class="
                    jd-historical-risk-controls
                ">

                    <button
                        type="button"
                        id="jdRiskPrevDay"
                        class="jd-risk-day-button">
                        ‹
                    </button>

                    <input
                        type="date"
                        id="jdHistoricalDate"
                        class="jd-risk-date">

                    <button
                        type="button"
                        id="jdRiskNextDay"
                        class="jd-risk-day-button">
                        ›
                    </button>

                </div>


                <div
                    id="jdHistoricalRiskSummary"
                    class="
                        jd-historical-risk-summary
                    ">
                </div>


                <div class="
                    jd-historical-risk-chart-wrap
                ">

                    <canvas
                        id="jdHistoricalRiskCanvas"
                        width="1000"
                        height="350">
                    </canvas>

                </div>

            </div>
        `;


        const dateInput =
            p2Get(
                "jdHistoricalDate"
            );


        if (dateInput) {

            dateInput.value =
                p2HistoricalDate;


            dateInput.addEventListener(
                "change",
                function () {

                    p2HistoricalDate =
                        this.value ||
                        p2DateKey();

                    p2RenderHistoricalRisk();

                }
            );
        }


        const previous =
            p2Get(
                "jdRiskPrevDay"
            );


        if (previous) {

            previous.addEventListener(
                "click",
                function () {

                    p2MoveRiskDate(
                        -1
                    );
                }
            );
        }


        const next =
            p2Get(
                "jdRiskNextDay"
            );


        if (next) {

            next.addEventListener(
                "click",
                function () {

                    p2MoveRiskDate(
                        1
                    );
                }
            );
        }


        p2RenderHistoricalRisk();
    }


    function p2MoveRiskDate(
        direction
    ) {

        const base =
            new Date(
                (
                    p2HistoricalDate ||
                    p2DateKey()
                ) +
                "T00:00:00"
            );


        if (
            Number.isNaN(
                base.getTime()
            )
        ) {
            return;
        }


        base.setDate(
            base.getDate() +
            direction
        );


        p2HistoricalDate =
            p2DateKey(
                base
            );


        const input =
            p2Get(
                "jdHistoricalDate"
            );


        if (input) {
            input.value =
                p2HistoricalDate;
        }


        p2RenderHistoricalRisk();
    }


    function p2RenderHistoricalRisk() {

        const history =
            p2RiskHistory();


        const records =
            history.filter(
                function (
                    item
                ) {

                    return (
                        item.date ===
                        p2HistoricalDate
                    );
                }
            );


        const summary =
            p2Get(
                "jdHistoricalRiskSummary"
            );


        if (summary) {

            if (!records.length) {

                summary.innerHTML = `

                    <div class="
                        jd-risk-summary-empty
                    ">
                        No historical risk data
                        available for
                        ${p2DisplayDate(
                            p2HistoricalDate
                        )}.
                    </div>
                `;

            } else {

                const values =
                    records
                        .map(
                            function (
                                item
                            ) {
                                return p2Num(
                                    item.risk
                                );
                            }
                        );


                const minimum =
                    Math.min(
                        ...values
                    );

                const maximum =
                    Math.max(
                        ...values
                    );

                const average =
                    values.reduce(
                        function (
                            total,
                            value
                        ) {
                            return (
                                total +
                                value
                            );
                        },
                        0
                    ) /
                    values.length;


                const latest =
                    values[
                        values.length - 1
                    ];


                summary.innerHTML = `

                    <div class="
                        jd-risk-summary-box
                    ">
                        <span>
                            Date
                        </span>

                        <strong>
                            ${p2DisplayDate(
                                p2HistoricalDate
                            )}
                        </strong>
                    </div>


                    <div class="
                        jd-risk-summary-box
                    ">
                        <span>
                            Readings
                        </span>

                        <strong>
                            ${values.length}
                        </strong>
                    </div>


                    <div class="
                        jd-risk-summary-box
                    ">
                        <span>
                            Minimum
                        </span>

                        <strong>
                            ${Math.round(
                                minimum
                            )}
                        </strong>
                    </div>


                    <div class="
                        jd-risk-summary-box
                    ">
                        <span>
                            Average
                        </span>

                        <strong>
                            ${Math.round(
                                average
                            )}
                        </strong>
                    </div>


                    <div class="
                        jd-risk-summary-box
                    ">
                        <span>
                            Maximum
                        </span>

                        <strong>
                            ${Math.round(
                                maximum
                            )}
                        </strong>
                    </div>


                    <div class="
                        jd-risk-summary-box
                    ">
                        <span>
                            Latest
                        </span>

                        <strong>
                            ${Math.round(
                                latest
                            )}
                        </strong>
                    </div>
                `;
            }
        }


        p2DrawHistoricalRiskCanvas(
            records
        );
    }


    function p2DrawHistoricalRiskCanvas(
        records
    ) {

        const canvas =
            p2Get(
                "jdHistoricalRiskCanvas"
            );


        if (!canvas) {
            return;
        }


        const context =
            canvas.getContext(
                "2d"
            );


        if (!context) {
            return;
        }


        const rect =
            canvas.getBoundingClientRect();


        const width =
            Math.max(
                700,
                Math.floor(
                    rect.width ||
                    1000
                )
            );


        const height =
            350;


        const dpr =
            window.devicePixelRatio ||
            1;


        canvas.width =
            width * dpr;

        canvas.height =
            height * dpr;


        canvas.style.height =
            height + "px";


        context.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );


        context.clearRect(
            0,
            0,
            width,
            height
        );


        const light =
            document.documentElement
                .classList
                .contains(
                    "light-theme"
                );


        const text =
            light
                ? "#263238"
                : "#dce7ef";


        const grid =
            light
                ? "rgba(30,60,80,.12)"
                : "rgba(180,210,225,.14)";


        const line =
            light
                ? "#1976d2"
                : "#4fc3f7";


        const left =
            55;

        const right =
            25;

        const top =
            25;

        const bottom =
            45;


        const chartWidth =
            width -
            left -
            right;


        const chartHeight =
            height -
            top -
            bottom;


        if (!records.length) {

            context.fillStyle =
                text;

            context.font =
                "15px Arial";

            context.textAlign =
                "center";

            context.textBaseline =
                "middle";

            context.fillText(
                "No risk readings for this date",
                width / 2,
                height / 2
            );

            return;
        }


        /* ================= GRID ================= */

        context.strokeStyle =
            grid;

        context.lineWidth =
            1;


        for (
            let i = 0;
            i <= 5;
            i++
        ) {

            const ratio =
                i / 5;


            const y =
                top +
                chartHeight *
                ratio;


            context.beginPath();

            context.moveTo(
                left,
                y
            );

            context.lineTo(
                width - right,
                y
            );

            context.stroke();


            context.fillStyle =
                text;

            context.font =
                "11px Arial";

            context.textAlign =
                "right";

            context.textBaseline =
                "middle";


            context.fillText(
                String(
                    100 -
                    Math.round(
                        ratio * 100
                    )
                ),
                left - 9,
                y
            );
        }


        /* ================= POINTS ================= */

        const points =
            records.map(
                function (
                    item,
                    index
                ) {

                    const risk =
                        p2Clamp(
                            p2Num(
                                item.risk
                            ),
                            0,
                            100
                        );


                    const x =
                        records.length === 1
                            ? left +
                              chartWidth / 2
                            : left +
                              (
                                  index /
                                  (
                                      records.length -
                                      1
                                  )
                              ) *
                              chartWidth;


                    const y =
                        top +
                        chartHeight -
                        (
                            risk /
                            100
                        ) *
                        chartHeight;


                    return {
                        x: x,
                        y: y
                    };
                }
            );


        /* ================= LINE ================= */

        context.beginPath();


        points.forEach(
            function (
                point,
                index
            ) {

                if (
                    index === 0
                ) {

                    context.moveTo(
                        point.x,
                        point.y
                    );

                } else {

                    context.lineTo(
                        point.x,
                        point.y
                    );
                }
            }
        );


        context.strokeStyle =
            line;

        context.lineWidth =
            2.5;

        context.stroke();


        /* ================= POINTS ================= */

        context.fillStyle =
            line;


        points.forEach(
            function (
                point
            ) {

                context.beginPath();

                context.arc(
                    point.x,
                    point.y,
                    3,
                    0,
                    Math.PI * 2
                );

                context.fill();
            }
        );


        /* ================= TIME ================= */

        context.fillStyle =
            text;

        context.font =
            "10px Arial";

        context.textAlign =
            "center";

        context.textBaseline =
            "top";


        const step =
            Math.max(
                1,
                Math.ceil(
                    records.length /
                    6
                )
            );


        records.forEach(
            function (
                item,
                index
            ) {

                if (
                    index % step !== 0 &&
                    index !==
                        records.length - 1
                ) {
                    return;
                }


                const point =
                    points[index];


                context.fillText(
                    item.time || "",
                    point.x,
                    height -
                    bottom +
                    10
                );
            }
        );
    }


    /* =====================================================
       5. LIVE REFRESH HOOK
       ===================================================== */

    function p2RunLiveFunctions() {

        /*
         * Fingerprint
         */

        try {
            p2UpdateFingerprint();
        } catch (error) {
            console.warn(
                "Fingerprint update error:",
                error
            );
        }


        /*
         * Smart alerts
         */

        try {
            p2UpdateSmartAlerts();
        } catch (error) {
            console.warn(
                "Smart alert update error:",
                error
            );
        }


        /*
         * Water Risk Trend
         */

        try {
            p2DrawRiskTrend();
        } catch (error) {
            console.warn(
                "Risk trend update error:",
                error
            );
        }


        /*
         * Historical risk
         */

        try {

            p2CreateHistoricalRiskUI();

            p2RenderHistoricalRisk();

        } catch (error) {

            console.warn(
                "Historical risk update error:",
                error
            );
        }
    }


    /* =====================================================
       6. PATCH updateDashboard
       ===================================================== */

    function p2PatchDashboard() {

        if (
            typeof updateDashboard !==
            "function"
        ) {
            return;
        }


        if (
            updateDashboard
                .__jdPart2Patched === true
        ) {
            return;
        }


        const original =
            updateDashboard;


        function patched() {

            const result =
                original.apply(
                    this,
                    arguments
                );


            /*
             * Existing dashboard has finished updating
             * sensor values. Now update the additional
             * live systems.
             */

            setTimeout(
                function () {

                    p2RunLiveFunctions();

                },
                0
            );


            return result;
        }


        patched.__jdPart2Patched =
            true;


        try {

            window.updateDashboard =
                patched;

        } catch (error) {

            console.warn(
                "Part 2 dashboard hook error:",
                error
            );
        }
    }


    /* =====================================================
       7. INDEPENDENT LIVE TIMER
       -----------------------------------------------------
       This ensures the added features continue to update
       even if another part of the dashboard does not call
       updateDashboard().
       ===================================================== */

    let p2LiveTimer = null;


    function p2StartLiveRefresh() {

        if (p2LiveTimer) {
            return;
        }


        p2RunLiveFunctions();


        p2LiveTimer =
            setInterval(
                function () {

                    p2RunLiveFunctions();

                },
                3000
            );
    }


    /* =====================================================
       8. WINDOW RESIZE
       ===================================================== */

    let p2ResizeTimer = null;


    window.addEventListener(
        "resize",
        function () {

            clearTimeout(
                p2ResizeTimer
            );


            p2ResizeTimer =
                setTimeout(
                    function () {

                        try {
                            p2DrawRiskTrend();
                        } catch (error) {}

                        try {
                            p2RenderHistoricalRisk();
                        } catch (error) {}

                    },
                    200
                );
        }
    );


    /* =====================================================
       9. INITIALIZATION
       ===================================================== */

    function p2Initialize() {

        p2PatchDashboard();

        p2CreateHistoricalRiskUI();

        p2StartLiveRefresh();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            p2Initialize,
            {
                once: true
            }
        );

    } else {

        p2Initialize();
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.JAL_DRISHTI_FINAL_PATCH =
        window.JAL_DRISHTI_FINAL_PATCH ||
        {};


    window.JAL_DRISHTI_FINAL_PATCH.part2 = {

        updateFingerprint:
            p2UpdateFingerprint,

        updateAlerts:
            p2UpdateSmartAlerts,

        drawRiskTrend:
            p2DrawRiskTrend,

        renderHistoricalRisk:
            p2RenderHistoricalRisk

    };

})();
/* =========================================================
   JAL-DRISHTI AI | FINAL FUNCTIONALITY PATCH
   PART 3 / 3
   ---------------------------------------------------------
   Adds:
   1. GIS Water Monitoring Map
   2. Satellite map
   3. Place search + suggestions
   4. Current location red arrow
   5. Nearby monitoring locations
   6. Nearby water sources
   7. Citizen dirty-water report
   8. Manual location
   9. Dirty-place photo mandatory
   10. Government cleaned-place photo mandatory
   11. Complete only after clean photo
   12. Resolution days
   13. Past + present report history
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       BASIC HELPERS
       ===================================================== */

    function p3Get(id) {
        return document.getElementById(id);
    }


    function p3Num(value, fallback = 0) {

        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : fallback;
    }


    function p3Date(date = new Date()) {

        const d =
            date instanceof Date
                ? date
                : new Date(date);

        if (
            Number.isNaN(
                d.getTime()
            )
        ) {
            return "";
        }

        return [
            d.getFullYear(),
            String(
                d.getMonth() + 1
            ).padStart(2, "0"),
            String(
                d.getDate()
            ).padStart(2, "0")
        ].join("-");
    }


    function p3DisplayDate(value) {

        if (!value) {
            return "--";
        }

        const d =
            new Date(
                value
            );

        if (
            Number.isNaN(
                d.getTime()
            )
        ) {
            return String(value);
        }

        return d.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
    }


    function p3Escape(value) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    /* =====================================================
       PART 3 STORAGE
       ===================================================== */

    const P3_REPORT_KEY =
        "jalDrishtiCitizenReports";


    function p3LoadReports() {

        try {

            const raw =
                localStorage.getItem(
                    P3_REPORT_KEY
                );

            if (!raw) {
                return [];
            }

            const data =
                JSON.parse(raw);

            return Array.isArray(data)
                ? data
                : [];

        } catch (error) {

            console.warn(
                "Citizen report storage error:",
                error
            );

            return [];
        }
    }


    function p3SaveReports(
        reports
    ) {

        try {

            localStorage.setItem(
                P3_REPORT_KEY,
                JSON.stringify(
                    reports
                )
            );

            return true;

        } catch (error) {

            console.warn(
                "Citizen report save error:",
                error
            );

            alert(
                "Storage is full. Please use smaller photos."
            );

            return false;
        }
    }


    /* =====================================================
       1. GIS MAP
       ===================================================== */

    let p3Map = null;

    let p3SatelliteLayer = null;

    let p3StreetLayer = null;

    let p3CurrentMarker = null;

    let p3SearchMarker = null;

    let p3MonitoringMarkers = [];

    let p3WaterMarkers = [];

    let p3MapReady = false;


    const P3_DEFAULT_LAT =
        23.0550;

    const P3_DEFAULT_LNG =
        72.6340;


    function p3InitializeMap() {

        const mapElement =
            p3Get(
                "waterMap"
            );

        if (!mapElement) {
            return;
        }


        /*
         * Leaflet is already loaded by the original
         * website before script.js.
         */

        if (
            typeof L ===
            "undefined"
        ) {

            console.warn(
                "Leaflet is not available."
            );

            return;
        }


        if (p3Map) {

            setTimeout(
                function () {

                    try {
                        p3Map.invalidateSize();
                    } catch (error) {}

                },
                300
            );

            return;
        }


        p3Map =
            L.map(
                mapElement,
                {
                    zoomControl: true,
                    attributionControl: true
                }
            )
            .setView(
                [
                    P3_DEFAULT_LAT,
                    P3_DEFAULT_LNG
                ],
                10
            );


        /*
         * Satellite imagery
         */

        p3SatelliteLayer =
            L.tileLayer(
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                {
                    maxZoom: 19,
                    attribution:
                        "Tiles © Esri"
                }
            );


        /*
         * Street map fallback
         */

        p3StreetLayer =
            L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    attribution:
                        "© OpenStreetMap contributors"
                }
            );


        /*
         * Start with satellite.
         */

        p3SatelliteLayer.addTo(
            p3Map
        );


        /*
         * Monitoring locations.
         */

        p3AddMonitoringLocations();


        /*
         * Map controls.
         */

        p3AddMapLayerControl();


        p3MapReady = true;


        setTimeout(
            function () {

                try {
                    p3Map.invalidateSize();
                } catch (error) {}

            },
            500
        );


        /*
         * Current location.
         */

        p3LocateUser(
            false
        );


        /*
         * Default nearby water source search.
         */

        p3FindNearbyWaterSources(
            P3_DEFAULT_LAT,
            P3_DEFAULT_LNG
        );
    }


    /* =====================================================
       2. MONITORING LOCATIONS
       ===================================================== */

    function p3MonitoringIcon() {

        return L.divIcon({
            className:
                "jd-monitoring-marker",
            html:
                `
                <div class="
                    jd-monitoring-pin
                ">
                    💧
                </div>
                `,
            iconSize:
                [36, 36],
            iconAnchor:
                [18, 36]
        });
    }


    function p3AddMonitoringLocations() {

        if (!p3Map) {
            return;
        }


        const locations = [

            {
                name:
                    "JAL-DRISHTI AI – Visnagar",
                lat:
                    23.7050,
                lng:
                    72.5470
            },

            {
                name:
                    "JAL-DRISHTI AI – Mehsana",
                lat:
                    23.5880,
                lng:
                    72.3693
            },

            {
                name:
                    "JAL-DRISHTI AI – Ahmedabad",
                lat:
                    23.0225,
                lng:
                    72.5714
            },

            {
                name:
                    "JAL-DRISHTI AI – Gandhinagar",
                lat:
                    23.2156,
                lng:
                    72.6369
            }
        ];


        locations.forEach(
            function (
                location
            ) {

                const marker =
                    L.marker(
                        [
                            location.lat,
                            location.lng
                        ],
                        {
                            icon:
                                p3MonitoringIcon()
                        }
                    )
                    .addTo(
                        p3Map
                    );


                marker.bindPopup(
                    `
                    <strong>
                        ${p3Escape(
                            location.name
                        )}
                    </strong>
                    <br>
                    <span>
                        JAL-DRISHTI AI Monitoring Location
                    </span>
                    `
                );


                p3MonitoringMarkers.push(
                    marker
                );
            }
        );
    }


    /* =====================================================
       3. MAP LAYER SWITCH
       ===================================================== */

    function p3AddMapLayerControl() {

        if (!p3Map) {
            return;
        }


        const layers = {

            "Satellite":
                p3SatelliteLayer,

            "Street":
                p3StreetLayer
        };


        L.control
            .layers(
                layers,
                null,
                {
                    collapsed:
                        true
                }
            )
            .addTo(
                p3Map
            );
    }


    /* =====================================================
       4. CURRENT LOCATION RED ARROW
       ===================================================== */

    function p3CurrentLocationIcon() {

        return L.divIcon({

            className:
                "jd-current-location-marker",

            html:
                `
                <div class="
                    jd-current-location-arrow
                ">
                    ↑
                </div>
                `,

            iconSize:
                [42, 42],

            iconAnchor:
                [21, 21]
        });
    }


    function p3LocateUser(
        centerMap = true
    ) {

        if (
            !navigator.geolocation
        ) {

            p3SetMapLocationText(
                "Location not available"
            );

            return;
        }


        navigator.geolocation.getCurrentPosition(

            function (
                position
            ) {

                const lat =
                    position.coords.latitude;

                const lng =
                    position.coords.longitude;


                if (!p3Map) {
                    return;
                }


                if (
                    p3CurrentMarker
                ) {

                    p3CurrentMarker.setLatLng(
                        [
                            lat,
                            lng
                        ]
                    );

                } else {

                    p3CurrentMarker =
                        L.marker(
                            [
                                lat,
                                lng
                            ],
                            {
                                icon:
                                    p3CurrentLocationIcon()
                            }
                        )
                        .addTo(
                            p3Map
                        );

                    p3CurrentMarker
                        .bindPopup(
                            "<strong>Your Current Location</strong>"
                        );
                }


                if (centerMap) {

                    p3Map.setView(
                        [
                            lat,
                            lng
                        ],
                        14
                    );
                }


                p3SetMapLocationText(
                    "Current Location"
                );


                p3FindNearbyWaterSources(
                    lat,
                    lng
                );


                p3UpdateNearestMonitoring(
                    lat,
                    lng
                );
            },

            function (
                error
            ) {

                console.warn(
                    "Geolocation error:",
                    error
                );

                p3SetMapLocationText(
                    "Location permission unavailable"
                );
            },

            {
                enableHighAccuracy:
                    true,
                timeout:
                    10000,
                maximumAge:
                    30000
            }
        );
    }


    function p3SetMapLocationText(
        text
    ) {

        const el =
            p3Get(
                "mapLocationText"
            );

        if (el) {
            el.textContent =
                text;
        }
    }


    /* =====================================================
       5. DISTANCE CALCULATION
       ===================================================== */

    function p3DistanceKm(
        lat1,
        lon1,
        lat2,
        lon2
    ) {

        const R =
            6371;

        const dLat =
            (
                lat2 -
                lat1
            ) *
            Math.PI /
            180;

        const dLon =
            (
                lon2 -
                lon1
            ) *
            Math.PI /
            180;


        const a =
            Math.sin(
                dLat / 2
            ) *
            Math.sin(
                dLat / 2
            ) +
            Math.cos(
                lat1 *
                Math.PI /
                180
            ) *
            Math.cos(
                lat2 *
                Math.PI /
                180
            ) *
            Math.sin(
                dLon / 2
            ) *
            Math.sin(
                dLon / 2
            );


        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );


        return R * c;
    }


    function p3UpdateNearestMonitoring(
        lat,
        lng
    ) {

        if (
            !p3MonitoringMarkers.length
        ) {
            return;
        }


        let nearest =
            null;

        let nearestDistance =
            Infinity;


        p3MonitoringMarkers.forEach(
            function (
                marker
            ) {

                const point =
                    marker.getLatLng();

                const distance =
                    p3DistanceKm(
                        lat,
                        lng,
                        point.lat,
                        point.lng
                    );


                if (
                    distance <
                    nearestDistance
                ) {

                    nearest =
                        marker;

                    nearestDistance =
                        distance;
                }
            }
        );


        if (!nearest) {
            return;
        }


        const popup =
            nearest.getPopup();


        if (popup) {

            const old =
                popup.getContent();

            popup.setContent(
                old +
                `<br><strong>
                    Distance: ${nearestDistance.toFixed(2)} km
                </strong>`
            );
        }


        const distanceEl =
            p3Get(
                "nearestWaterDistance"
            );


        if (distanceEl) {

            distanceEl.textContent =
                nearestDistance.toFixed(
                    2
                ) +
                " km";
        }
    }


    /* =====================================================
       6. NEARBY WATER SOURCES
       -----------------------------------------------------
       Uses OpenStreetMap Overpass when available.
       ===================================================== */

    async function p3FindNearbyWaterSources(
        lat,
        lng
    ) {

        if (!p3Map) {
            return;
        }


        /*
         * Remove previous water markers.
         */

        p3WaterMarkers.forEach(
            function (
                marker
            ) {

                try {
                    p3Map.removeLayer(
                        marker
                    );
                } catch (error) {}

            }
        );


        p3WaterMarkers = [];


        const query = `
            [out:json][timeout:15];
            (
                nwr(around:10000,${lat},${lng})
                    ["natural"="water"];

                nwr(around:10000,${lat},${lng})
                    ["waterway"];

                nwr(around:10000,${lat},${lng})
                    ["water"="reservoir"];

                nwr(around:10000,${lat},${lng})
                    ["amenity"="drinking_water"];
            );
            out center tags;
        `;


        try {

            const response =
                await fetch(
                    "https://overpass-api.de/api/interpreter",
                    {
                        method:
                            "POST",

                        body:
                            query,

                        headers: {
                            "Content-Type":
                                "text/plain"
                        }
                    }
                );


            if (
                !response.ok
            ) {
                throw new Error(
                    "Overpass request failed"
                );
            }


            const data =
                await response.json();


            const elements =
                Array.isArray(
                    data.elements
                )
                    ? data.elements
                    : [];


            elements
                .slice(
                    0,
                    40
                )
                .forEach(
                    function (
                        item
                    ) {

                        const point =
                            p3ElementPoint(
                                item
                            );


                        if (!point) {
                            return;
                        }


                        const tags =
                            item.tags ||
                            {};


                        const name =
                            tags.name ||
                            tags.waterway ||
                            tags.natural ||
                            "Water Source";


                        const marker =
                            L.circleMarker(
                                [
                                    point.lat,
                                    point.lng
                                ],
                                {
                                    radius:
                                        6,

                                    weight:
                                        2,

                                    fillOpacity:
                                        0.85
                                }
                            )
                            .addTo(
                                p3Map
                            );


                        marker.bindPopup(
                            `
                            <strong>
                                ${p3Escape(
                                    name
                                )}
                            </strong>
                            <br>
                            Nearby Water Source
                            `
                        );


                        p3WaterMarkers.push(
                            marker
                        );
                    }
                );


            const nearest =
                p3NearestWater(
                    lat,
                    lng
                );


            if (nearest) {

                p3SetText(
                    "nearestWaterText",
                    nearest.name
                );

                p3SetText(
                    "nearestWaterDistance",
                    nearest.distance.toFixed(
                        2
                    ) + " km"
                );

            } else {

                p3SetText(
                    "nearestWaterText",
                    "No nearby source found"
                );

            }


        } catch (error) {

            console.warn(
                "Nearby water source lookup failed:",
                error
            );

            p3SetText(
                "nearestWaterText",
                "Water-source data unavailable"
            );
        }
    }


    function p3ElementPoint(
        item
    ) {

        if (
            Number.isFinite(
                Number(item.lat)
            ) &&
            Number.isFinite(
                Number(item.lon)
            )
        ) {

            return {
                lat:
                    Number(item.lat),
                lng:
                    Number(item.lon)
            };
        }


        if (
            item.center &&
            Number.isFinite(
                Number(
                    item.center.lat
                )
            ) &&
            Number.isFinite(
                Number(
                    item.center.lon
                )
            )
        ) {

            return {
                lat:
                    Number(
                        item.center.lat
                    ),
                lng:
                    Number(
                        item.center.lon
                    )
            };
        }


        return null;
    }


    function p3NearestWater(
        lat,
        lng
    ) {

        let nearest =
            null;


        p3WaterMarkers.forEach(
            function (
                marker
            ) {

                const point =
                    marker.getLatLng();


                const distance =
                    p3DistanceKm(
                        lat,
                        lng,
                        point.lat,
                        point.lng
                    );


                const popup =
                    marker.getPopup();


                let name =
                    "Water Source";


                if (popup) {

                    const content =
                        popup.getContent();

                    const match =
                        content.match(
                            /<strong>(.*?)<\/strong>/
                        );

                    if (match) {
                        name =
                            match[1];
                    }
                }


                if (
                    !nearest ||
                    distance <
                        nearest.distance
                ) {

                    nearest = {
                        name:
                            name,
                        distance:
                            distance
                    };
                }
            }
        );


        return nearest;
    }


    function p3SetText(
        id,
        text
    ) {

        const el =
            p3Get(id);

        if (el) {
            el.textContent =
                text;
        }
    }


    /* =====================================================
       7. PLACE SEARCH
       -----------------------------------------------------
       Search suggestions behave like a simple
       Google-Maps-style autocomplete.
       ===================================================== */

    const P3_SUGGESTIONS = [

        {
            name:
                "Ahmedabad, Gujarat",
            lat:
                23.0225,
            lng:
                72.5714
        },

        {
            name:
                "Ambaji, Gujarat",
            lat:
                24.3290,
            lng:
                72.3900
        },

        {
            name:
                "Visnagar, Gujarat",
            lat:
                23.7050,
            lng:
                72.5470
        },

        {
            name:
                "Mehsana, Gujarat",
            lat:
                23.5880,
            lng:
                72.3693
        },

        {
            name:
                "Gandhinagar, Gujarat",
            lat:
                23.2156,
            lng:
                72.6369
        },

        {
            name:
                "Vadodara, Gujarat",
            lat:
                22.3072,
            lng:
                73.1812
        },

        {
            name:
                "Surat, Gujarat",
            lat:
                21.1702,
            lng:
                72.8311
        },

        {
            name:
                "Rajkot, Gujarat",
            lat:
                22.3039,
            lng:
                70.8022
        },

        {
            name:
                "Patan, Gujarat",
            lat:
                23.8493,
            lng:
                72.1266
        },

        {
            name:
                "Udaipur, Rajasthan",
            lat:
                24.5854,
            lng:
                73.7125
        },

        {
            name:
                "Mumbai, Maharashtra",
            lat:
                19.0760,
            lng:
                72.8777
        },

        {
            name:
                "Delhi, India",
            lat:
                28.6139,
            lng:
                77.2090
        }
    ];


    let p3SearchTimer =
        null;


    function p3CreateSearchSuggestions() {

        const input =
            p3Get(
                "mapSearchInput"
            );


        if (!input) {
            return;
        }


        if (
            input.dataset
                .jdSearchReady === "1"
        ) {
            return;
        }


        input.dataset
            .jdSearchReady = "1";


        const wrapper =
            input.parentElement;


        if (!wrapper) {
            return;
        }


        wrapper.style.position =
            "relative";


        const dropdown =
            document.createElement(
                "div"
            );


        dropdown.id =
            "jdMapSearchSuggestions";


        dropdown.className =
            "jd-map-search-suggestions";


        wrapper.appendChild(
            dropdown
        );


        input.addEventListener(
            "input",
            function () {

                const query =
                    this.value
                        .trim()
                        .toLowerCase();


                clearTimeout(
                    p3SearchTimer
                );


                if (
                    query.length === 0
                ) {

                    dropdown.innerHTML =
                        "";

                    dropdown.style.display =
                        "none";

                    return;
                }


                /*
                 * Show instant local suggestions.
                 */

                p3ShowLocalSuggestions(
                    query,
                    dropdown
                );


                /*
                 * Also search Nominatim after a short delay.
                 */

                p3SearchTimer =
                    setTimeout(
                        function () {

                            p3RemotePlaceSearch(
                                query,
                                dropdown
                            );

                        },
                        500
                    );
            }
        );


        input.addEventListener(
            "keydown",
            function (
                event
            ) {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    p3SearchPlace(
                        this.value
                    );

                    dropdown.style.display =
                        "none";
                }

                if (
                    event.key ===
                    "Escape"
                ) {

                    dropdown.style.display =
                        "none";
                }
            }
        );


        document.addEventListener(
            "click",
            function (
                event
            ) {

                if (
                    !wrapper.contains(
                        event.target
                    )
                ) {

                    dropdown.style.display =
                        "none";
                }
            }
        );
    }


    function p3ShowLocalSuggestions(
        query,
        dropdown
    ) {

        const matches =
            P3_SUGGESTIONS
                .filter(
                    function (
                        place
                    ) {

                        return place.name
                            .toLowerCase()
                            .includes(
                                query
                            );
                    }
                )
                .slice(
                    0,
                    8
                );


        if (!matches.length) {

            dropdown.innerHTML =
                `
                <div class="
                    jd-map-suggestion-empty
                ">
                    Searching places...
                </div>
                `;

        } else {

            dropdown.innerHTML =
                matches
                    .map(
                        function (
                            place
                        ) {

                            return `
                            <button
                                type="button"
                                class="
                                    jd-map-suggestion
                                "
                                data-lat="${place.lat}"
                                data-lng="${place.lng}"
                                data-name="${p3Escape(place.name)}">

                                <span>
                                    📍
                                </span>

                                <span>
                                    ${p3Escape(
                                        place.name
                                    )}
                                </span>

                            </button>
                            `;
                        }
                    )
                    .join("");


            dropdown
                .querySelectorAll(
                    ".jd-map-suggestion"
                )
                .forEach(
                    function (
                        button
                    ) {

                        button.addEventListener(
                            "click",
                            function () {

                                const lat =
                                    Number(
                                        this.dataset.lat
                                    );

                                const lng =
                                    Number(
                                        this.dataset.lng
                                    );

                                const name =
                                    this.dataset.name;


                                p3GoToPlace(
                                    lat,
                                    lng,
                                    name
                                );


                                dropdown.style.display =
                                    "none";


                                const input =
                                    p3Get(
                                        "mapSearchInput"
                                    );

                                if (input) {
                                    input.value =
                                        name;
                                }
                            }
                        );
                    }
                );
        }


        dropdown.style.display =
            "block";
    }


    async function p3RemotePlaceSearch(
        query,
        dropdown
    ) {

        if (
            query.length < 2
        ) {
            return;
        }


        try {

            const url =
                "https://nominatim.openstreetmap.org/search" +
                "?format=jsonv2" +
                "&limit=6" +
                "&countrycodes=in" +
                "&q=" +
                encodeURIComponent(
                    query
                );


            const response =
                await fetch(
                    url,
                    {
                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );


            if (
                !response.ok
            ) {
                return;
            }


            const data =
                await response.json();


            if (
                !Array.isArray(
                    data
                ) ||
                !data.length
            ) {
                return;
            }


            const remote =
                data.map(
                    function (
                        item
                    ) {

                        return {
                            name:
                                item.display_name,
                            lat:
                                Number(
                                    item.lat
                                ),
                            lng:
                                Number(
                                    item.lon
                                )
                        };
                    }
                );


            const existing =
                Array.from(
                    dropdown.querySelectorAll(
                        ".jd-map-suggestion"
                    )
                )
                .map(
                    function (
                        button
                    ) {
                        return (
                            button.dataset.name ||
                            ""
                        ).toLowerCase();
                    }
                );


            remote.forEach(
                function (
                    place
                ) {

                    if (
                        existing.includes(
                            place.name
                                .toLowerCase()
                        )
                    ) {
                        return;
                    }


                    const button =
                        document.createElement(
                            "button"
                        );


                    button.type =
                        "button";


                    button.className =
                        "jd-map-suggestion";


                    button.innerHTML =
                        `
                        <span>
                            📍
                        </span>

                        <span>
                            ${p3Escape(
                                place.name
                            )}
                        </span>
                        `;


                    button.addEventListener(
                        "click",
                        function () {

                            p3GoToPlace(
                                place.lat,
                                place.lng,
                                place.name
                            );


                            dropdown.style.display =
                                "none";


                            const input =
                                p3Get(
                                    "mapSearchInput"
                                );

                            if (input) {
                                input.value =
                                    place.name;
                            }
                        }
                    );


                    dropdown.appendChild(
                        button
                    );
                }
            );

        } catch (error) {

            console.warn(
                "Place search error:",
                error
            );
        }
    }


    function p3SearchPlace(
        query
    ) {

        const text =
            String(
                query || ""
            )
            .trim()
            .toLowerCase();


        if (!text) {
            return;
        }


        const local =
            P3_SUGGESTIONS.find(
                function (
                    place
                ) {

                    return (
                        place.name
                            .toLowerCase() ===
                        text
                    );
                }
            );


        if (local) {

            p3GoToPlace(
                local.lat,
                local.lng,
                local.name
            );

            return;
        }


        p3RemotePlaceSearchAndGo(
            query
        );
    }


    async function p3RemotePlaceSearchAndGo(
        query
    ) {

        try {

            const url =
                "https://nominatim.openstreetmap.org/search" +
                "?format=jsonv2" +
                "&limit=1" +
                "&countrycodes=in" +
                "&q=" +
                encodeURIComponent(
                    query
                );


            const response =
                await fetch(
                    url
                );


            if (
                !response.ok
            ) {
                throw new Error(
                    "Search failed"
                );
            }


            const data =
                await response.json();


            if (
                !Array.isArray(
                    data
                ) ||
                !data.length
            ) {

                alert(
                    "Place not found."
                );

                return;
            }


            const place =
                data[0];


            p3GoToPlace(
                Number(
                    place.lat
                ),
                Number(
                    place.lon
                ),
                place.display_name
            );


        } catch (error) {

            console.warn(
                "Remote place search error:",
                error
            );

            alert(
                "Unable to search this place right now."
            );
        }
    }


    function p3GoToPlace(
        lat,
        lng,
        name
    ) {

        if (!p3Map) {
            p3InitializeMap();
        }


        if (!p3Map) {
            return;
        }


        if (
            p3SearchMarker
        ) {

            p3SearchMarker.setLatLng(
                [
                    lat,
                    lng
                ]
            );

        } else {

            p3SearchMarker =
                L.marker(
                    [
                        lat,
                        lng
                    ]
                )
                .addTo(
                    p3Map
                );
        }


        p3SearchMarker
            .bindPopup(
                `
                <strong>
                    ${p3Escape(
                        name
                    )}
                </strong>
                `
            )
            .openPopup();


        p3Map.setView(
            [
                lat,
                lng
            ],
            14
        );


        p3SetMapLocationText(
            name
        );


        p3FindNearbyWaterSources(
            lat,
            lng
        );


        p3UpdateNearestMonitoring(
            lat,
            lng
        );
    }


    /* =====================================================
       8. MAP BUTTONS
       ===================================================== */

    function p3InitializeMapButtons() {

        const searchButton =
            p3Get(
                "mapSearchButton"
            );


        if (
            searchButton &&
            searchButton.dataset
                .jdReady !== "1"
        ) {

            searchButton.dataset
                .jdReady = "1";


            searchButton.addEventListener(
                "click",
                function () {

                    const input =
                        p3Get(
                            "mapSearchInput"
                        );


                    p3SearchPlace(
                        input
                            ? input.value
                            : ""
                    );
                }
            );
        }


        const locationButton =
            p3Get(
                "mapLocationButton"
            );


        if (
            locationButton &&
            locationButton.dataset
                .jdReady !== "1"
        ) {

            locationButton.dataset
                .jdReady = "1";


            locationButton.addEventListener(
                "click",
                function () {

                    p3LocateUser(
                        true
                    );
                }
            );
        }


        const fullscreen =
            p3Get(
                "mapFullscreenButton"
            );


        if (
            fullscreen &&
            fullscreen.dataset
                .jdReady !== "1"
        ) {

            fullscreen.dataset
                .jdReady = "1";


            fullscreen.addEventListener(
                "click",
                function () {

                    const mapElement =
                        p3Get(
                            "waterMap"
                        );


                    if (
                        !mapElement
                    ) {
                        return;
                    }


                    if (
                        !document.fullscreenElement
                    ) {

                        if (
                            mapElement
                                .requestFullscreen
                        ) {

                            mapElement
                                .requestFullscreen();

                        } else {

                            mapElement
                                .classList
                                .toggle(
                                    "jd-map-expanded"
                                );
                        }

                    } else {

                        document
                            .exitFullscreen();

                    }


                    setTimeout(
                        function () {

                            try {
                                p3Map.invalidateSize();
                            } catch (error) {}

                        },
                        500
                    );
                }
            );
        }


        document.addEventListener(
            "fullscreenchange",
            function () {

                setTimeout(
                    function () {

                        try {
                            p3Map.invalidateSize();
                        } catch (error) {}

                    },
                    300
                );
            }
        );
    }


    /* =====================================================
       9. CITIZEN REPORT PHOTO COMPRESSION
       ===================================================== */

    function p3CompressImage(
        file,
        maxSize = 1100,
        quality = 0.72
    ) {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                if (!file) {
                    reject(
                        new Error(
                            "No file"
                        )
                    );

                    return;
                }


                const reader =
                    new FileReader();


                reader.onload =
                    function () {

                        const image =
                            new Image();


                        image.onload =
                            function () {

                                let width =
                                    image.width;

                                let height =
                                    image.height;


                                if (
                                    width >
                                        maxSize ||
                                    height >
                                        maxSize
                                ) {

                                    const ratio =
                                        Math.min(
                                            maxSize /
                                                width,
                                            maxSize /
                                                height
                                        );

                                    width =
                                        Math.round(
                                            width *
                                            ratio
                                        );

                                    height =
                                        Math.round(
                                            height *
                                            ratio
                                        );
                                }


                                const canvas =
                                    document
                                        .createElement(
                                            "canvas"
                                        );


                                canvas.width =
                                    width;

                                canvas.height =
                                    height;


                                const context =
                                    canvas.getContext(
                                        "2d"
                                    );


                                context.drawImage(
                                    image,
                                    0,
                                    0,
                                    width,
                                    height
                                );


                                resolve(
                                    canvas.toDataURL(
                                        "image/jpeg",
                                        quality
                                    )
                                );
                            };


                        image.onerror =
                            reject;


                        image.src =
                            reader.result;
                    };


                reader.onerror =
                    reject;


                reader.readAsDataURL(
                    file
                );
            }
        );
    }


    /* =====================================================
       10. CITIZEN MANUAL LOCATION UI
       ===================================================== */

    function p3CreateCitizenLocationUI() {

        const gpsButton =
            p3Get(
                "captureReportLocation"
            );


        if (!gpsButton) {
            return;
        }


        if (
            p3Get(
                "jdCitizenManualLocation"
            )
        ) {
            return;
        }


        const parent =
            gpsButton.parentElement;


        if (!parent) {
            return;
        }


        const box =
            document.createElement(
                "div"
            );


        box.id =
            "jdCitizenManualLocation";


        box.className =
            "jd-citizen-manual-location";


        box.innerHTML = `

            <div class="
                jd-manual-location-title
            ">
                📍 Or set location manually
            </div>


            <div class="
                jd-manual-location-row
            ">

                <input
                    type="text"
                    id="jdCitizenLocationInput"
                    class="
                        jd-citizen-location-input
                    "
                    placeholder="
                        Search city / place
                    "
                    autocomplete="off">


                <button
                    type="button"
                    id="jdCitizenLocationSearch"
                    class="
                        jd-citizen-location-search
                    ">
                    Set
                </button>

            </div>


            <div
                id="jdCitizenLocationSuggestions"
                class="
                    jd-citizen-location-suggestions
                ">
            </div>


            <div class="
                jd-manual-coordinate-row
            ">

                <input
                    type="number"
                    step="any"
                    id="jdCitizenLatitude"
                    placeholder="Latitude">

                <input
                    type="number"
                    step="any"
                    id="jdCitizenLongitude"
                    placeholder="Longitude">

            </div>

        `;


        parent.appendChild(
            box
        );


        const input =
            p3Get(
                "jdCitizenLocationInput"
            );


        const search =
            p3Get(
                "jdCitizenLocationSearch"
            );


        const suggestions =
            p3Get(
                "jdCitizenLocationSuggestions"
            );


        if (
            input &&
            suggestions
        ) {

            input.addEventListener(
                "input",
                function () {

                    const query =
                        this.value
                            .trim()
                            .toLowerCase();


                    if (!query) {

                        suggestions.innerHTML =
                            "";

                        suggestions.style.display =
                            "none";

                        return;
                    }


                    const matches =
                        P3_SUGGESTIONS
                            .filter(
                                function (
                                    place
                                ) {

                                    return (
                                        place.name
                                            .toLowerCase()
                                            .includes(
                                                query
                                            )
                                    );
                                }
                            )
                            .slice(
                                0,
                                6
                            );


                    suggestions.innerHTML =
                        matches
                            .map(
                                function (
                                    place
                                ) {

                                    return `

                                    <button
                                        type="button"
                                        class="
                                            jd-citizen-location-option
                                        "
                                        data-name="${p3Escape(place.name)}"
                                        data-lat="${place.lat}"
                                        data-lng="${place.lng}">

                                        📍
                                        ${p3Escape(
                                            place.name
                                        )}

                                    </button>

                                    `;
                                }
                            )
                            .join("");


                    suggestions.style.display =
                        matches.length
                            ? "block"
                            : "none";


                    suggestions
                        .querySelectorAll(
                            ".jd-citizen-location-option"
                        )
                        .forEach(
                            function (
                                button
                            ) {

                                button.addEventListener(
                                    "click",
                                    function () {

                                        input.value =
                                            this.dataset.name;


                                        const lat =
                                            p3Get(
                                                "jdCitizenLatitude"
                                            );

                                        const lng =
                                            p3Get(
                                                "jdCitizenLongitude"
                                            );


                                        if (lat) {
                                            lat.value =
                                                this.dataset.lat;
                                        }


                                        if (lng) {
                                            lng.value =
                                                this.dataset.lng;
                                        }


                                        suggestions.style.display =
                                            "none";


                                        p3SetReportLocationText(
                                            this.dataset.name
                                        );
                                    }
                                );
                            }
                        );
                }
            );
        }


        if (search) {

            search.addEventListener(
                "click",
                function () {

                    p3SetCitizenManualLocation();
                }
            );
        }
    }


    function p3SetCitizenManualLocation() {

        const input =
            p3Get(
                "jdCitizenLocationInput"
            );


        const latInput =
            p3Get(
                "jdCitizenLatitude"
            );


        const lngInput =
            p3Get(
                "jdCitizenLongitude"
            );


        const query =
            input
                ? input.value.trim()
                : "";


        if (!query) {

            const lat =
                latInput
                    ? Number(
                        latInput.value
                    )
                    : NaN;


            const lng =
                lngInput
                    ? Number(
                        lngInput.value
                    )
                    : NaN;


            if (
                Number.isFinite(lat) &&
                Number.isFinite(lng)
            ) {

                p3SaveTemporaryReportLocation(
                    {
                        name:
                            "Manual coordinates",
                        lat:
                            lat,
                        lng:
                            lng
                    }
                );

                return;
            }


            alert(
                "Enter a place name or latitude and longitude."
            );

            return;
        }


        const local =
            P3_SUGGESTIONS.find(
                function (
                    place
                ) {

                    return (
                        place.name
                            .toLowerCase()
                            .includes(
                                query.toLowerCase()
                            )
                    );
                }
            );


        if (local) {

            if (latInput) {
                latInput.value =
                    local.lat;
            }

            if (lngInput) {
                lngInput.value =
                    local.lng;
            }


            p3SaveTemporaryReportLocation(
                {
                    name:
                        local.name,
                    lat:
                        local.lat,
                    lng:
                        local.lng
                }
            );


            return;
        }


        /*
         * Try online search.
         */

        p3CitizenRemoteLocation(
            query
        );
    }


    async function p3CitizenRemoteLocation(
        query
    ) {

        try {

            const url =
                "https://nominatim.openstreetmap.org/search" +
                "?format=jsonv2" +
                "&limit=1" +
                "&countrycodes=in" +
                "&q=" +
                encodeURIComponent(
                    query
                );


            const response =
                await fetch(
                    url
                );


            if (
                !response.ok
            ) {
                throw new Error(
                    "Location search failed"
                );
            }


            const data =
                await response.json();


            if (
                !data.length
            ) {

                alert(
                    "Location not found."
                );

                return;
            }


            const place =
                data[0];


            const location = {

                name:
                    place.display_name,

                lat:
                    Number(
                        place.lat
                    ),

                lng:
                    Number(
                        place.lon
                    )
            };


            const latInput =
                p3Get(
                    "jdCitizenLatitude"
                );


            const lngInput =
                p3Get(
                    "jdCitizenLongitude"
                );


            if (latInput) {
                latInput.value =
                    location.lat;
            }


            if (lngInput) {
                lngInput.value =
                    location.lng;
            }


            p3SaveTemporaryReportLocation(
                location
            );


        } catch (error) {

            console.warn(
                "Citizen location error:",
                error
            );

            alert(
                "Unable to set this location right now."
            );
        }
    }


    let p3TemporaryReportLocation =
        null;


    function p3SaveTemporaryReportLocation(
        location
    ) {

        p3TemporaryReportLocation =
            location;


        p3SetReportLocationText(
            location.name +
            " (" +
            Number(
                location.lat
            ).toFixed(5) +
            ", " +
            Number(
                location.lng
            ).toFixed(5) +
            ")"
        );


        /*
         * If map exists, show the selected location.
         */

        if (p3Map) {

            p3GoToPlace(
                location.lat,
                location.lng,
                location.name
            );
        }
    }


    function p3SetReportLocationText(
        text
    ) {

        const status =
            p3Get(
                "reportLocationStatus"
            );


        if (status) {

            status.textContent =
                "📍 " + text;
        }
    }


    /* =====================================================
       11. GPS LOCATION FOR CITIZEN REPORT
       ===================================================== */

    function p3PatchCitizenGPS() {

        const button =
            p3Get(
                "captureReportLocation"
            );


        if (!button) {
            return;
        }


        if (
            button.dataset
                .jdGpsReady === "1"
        ) {
            return;
        }


        button.dataset
            .jdGpsReady = "1";


        button.addEventListener(
            "click",
            function () {

                if (
                    !navigator.geolocation
                ) {

                    alert(
                        "Geolocation is not supported."
                    );

                    return;
                }


                const status =
                    p3Get(
                        "reportLocationStatus"
                    );


                if (status) {
                    status.textContent =
                        "📍 Getting your location...";
                }


                navigator.geolocation.getCurrentPosition(

                    function (
                        position
                    ) {

                        const lat =
                            position.coords.latitude;

                        const lng =
                            position.coords.longitude;


                        p3TemporaryReportLocation =
                            {
                                name:
                                    "GPS Current Location",
                                lat:
                                    lat,
                                lng:
                                    lng
                            };


                        const latInput =
                            p3Get(
                                "jdCitizenLatitude"
                            );


                        const lngInput =
                            p3Get(
                                "jdCitizenLongitude"
                            );


                        if (latInput) {
                            latInput.value =
                                lat;
                        }


                        if (lngInput) {
                            lngInput.value =
                                lng;
                        }


                        p3SetReportLocationText(
                            `GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`
                        );

                    },

                    function (
                        error
                    ) {

                        console.warn(
                            "Citizen GPS error:",
                            error
                        );


                        if (status) {
                            status.textContent =
                                "❌ Unable to get GPS location.";
                        }

                    },

                    {
                        enableHighAccuracy:
                            true,
                        timeout:
                            10000,
                        maximumAge:
                            30000
                    }
                );
            }
        );
    }


    /* =====================================================
       12. REPORT PHOTO PREVIEW
       ===================================================== */

    function p3InitializeReportPhoto() {

        const input =
            p3Get(
                "reportPhoto"
            );


        if (!input) {
            return;
        }


        if (
            input.dataset
                .jdPhotoReady === "1"
        ) {
            return;
        }


        input.dataset
            .jdPhotoReady = "1";


        input.addEventListener(
            "change",
            function () {

                const file =
                    this.files &&
                    this.files[0];


                const status =
                    p3Get(
                        "reportPhotoStatus"
                    );


                const preview =
                    p3Get(
                        "reportPhotoPreview"
                    );


                if (!file) {

                    if (status) {
                        status.textContent =
                            "Photo required";
                    }

                    return;
                }


                if (
                    !file.type.startsWith(
                        "image/"
                    )
                ) {

                    alert(
                        "Please select an image file."
                    );


                    this.value =
                        "";

                    return;
                }


                if (status) {

                    status.textContent =
                        "✓ Dirty-place photo selected";
                }


                if (preview) {

                    const reader =
                        new FileReader();


                    reader.onload =
                        function () {

                            preview.src =
                                reader.result;

                            preview.style.display =
                                "block";
                        };


                    reader.readAsDataURL(
                        file
                    );
                }
            }
        );
    }


    /* =====================================================
       13. REPORT SUBMISSION
       ===================================================== */

    function p3InitializeCitizenSubmit() {

        const button =
            p3Get(
                "submitWaterReport"
            );


        if (!button) {
            return;
        }


        if (
            button.dataset
                .jdSubmitReady === "1"
        ) {
            return;
        }


        button.dataset
            .jdSubmitReady = "1";


        button.addEventListener(
            "click",
            async function () {

                const reporter =
                    p3Get(
                        "reporterName"
                    );


                const photoInput =
                    p3Get(
                        "reportPhoto"
                    );


                const description =
                    p3Get(
                        "reportDescription"
                    );


                const name =
                    reporter
                        ? reporter.value.trim()
                        : "";


                const photoFile =
                    photoInput &&
                    photoInput.files
                        ? photoInput.files[0]
                        : null;


                const desc =
                    description
                        ? description.value.trim()
                        : "";


                /*
                 * Dirty photo is mandatory.
                 */

                if (!photoFile) {

                    alert(
                        "Dirty-place photo is mandatory."
                    );

                    return;
                }


                /*
                 * Description is also required.
                 */

                if (!desc) {

                    alert(
                        "Please describe the water problem."
                    );

                    return;
                }


                let location =
                    p3TemporaryReportLocation;


                /*
                 * Try manual coordinates if the
                 * temporary object does not exist.
                 */

                if (!location) {

                    const lat =
                        p3Num(
                            (
                                p3Get(
                                    "jdCitizenLatitude"
                                ) || {}
                            ).value,
                            NaN
                        );


                    const lng =
                        p3Num(
                            (
                                p3Get(
                                    "jdCitizenLongitude"
                                ) || {}
                            ).value,
                            NaN
                        );


                    if (
                        Number.isFinite(
                            lat
                        ) &&
                        Number.isFinite(
                            lng
                        )
                    ) {

                        location = {

                            name:
                                "Manual Location",

                            lat:
                                lat,

                            lng:
                                lng
                        };
                    }
                }


                /*
                 * Location is required.
                 */

                if (!location) {

                    alert(
                        "Please set the report location manually or use GPS."
                    );

                    return;
                }


                try {

                    button.disabled =
                        true;


                    button.textContent =
                        "Submitting...";


                    const dirtyPhoto =
                        await p3CompressImage(
                            photoFile
                        );


                    const now =
                        Date.now();


                    const report = {

                        id:
                            "JDA-" +
                            now +
                            "-" +
                            Math.floor(
                                Math.random() *
                                10000
                            ),

                        reporter:
                            name ||
                            "Citizen",

                        description:
                            desc,

                        dirtyPhoto:
                            dirtyPhoto,

                        locationName:
                            location.name,

                        latitude:
                            Number(
                                location.lat
                            ),

                        longitude:
                            Number(
                                location.lng
                            ),

                        createdAt:
                            now,

                        createdDate:
                            p3Date(
                                new Date(
                                    now
                                )
                            ),

                        status:
                            "PENDING",

                        completedAt:
                            null,

                        cleanPhoto:
                            null,

                        resolutionDays:
                            null
                    };


                    const reports =
                        p3LoadReports();


                    reports.push(
                        report
                    );


                    if (
                        !p3SaveReports(
                            reports
                        )
                    ) {

                        return;
                    }


                    alert(
                        "Citizen water report submitted successfully."
                    );


                    /*
                     * Reset fields.
                     */

                    if (photoInput) {
                        photoInput.value =
                            "";
                    }


                    if (description) {
                        description.value =
                            "";
                    }


                    p3TemporaryReportLocation =
                        null;


                    const status =
                        p3Get(
                            "reportPhotoStatus"
                        );


                    if (status) {
                        status.textContent =
                            "Photo required";
                    }


                    const preview =
                        p3Get(
                            "reportPhotoPreview"
                        );


                    if (preview) {

                        preview.src =
                            "";

                        preview.style.display =
                            "none";
                    }


                    p3RenderCitizenReports();


                } catch (error) {

                    console.error(
                        "Citizen report submission error:",
                        error
                    );


                    alert(
                        "Unable to save the report."
                    );

                } finally {

                    button.disabled =
                        false;

                    button.textContent =
                        "Submit Water Report";
                }
            }
        );
    }


    /* =====================================================
       14. GOVERNMENT REPORT MANAGEMENT
       ===================================================== */

    function p3ResolutionDays(
        createdAt,
        completedAt
    ) {

        const start =
            Number(
                createdAt
            );


        const end =
            completedAt
                ? Number(
                    completedAt
                )
                : Date.now();


        if (
            !Number.isFinite(
                start
            ) ||
            !Number.isFinite(
                end
            )
        ) {
            return 0;
        }


        return Math.max(
            0,
            Math.ceil(
                (
                    end -
                    start
                ) /
                (
                    1000 *
                    60 *
                    60 *
                    24
                )
            )
        );
    }


    function p3InitializeGovernmentResolution() {

        /*
         * Rendering itself creates the clean-photo controls,
         * so no separate static HTML is necessary.
         */

        p3RenderCitizenReports();
    }


    async function p3CompleteReport(
        reportId,
        file
    ) {

        if (!file) {

            alert(
                "Cleaned-place photo is mandatory before Complete."
            );

            return;
        }


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "Please select a valid cleaned-place image."
            );

            return;
        }


        const reports =
            p3LoadReports();


        const index =
            reports.findIndex(
                function (
                    report
                ) {

                    return (
                        report.id ===
                        reportId
                    );
                }
            );


        if (index === -1) {

            alert(
                "Report not found."
            );

            return;
        }


        const report =
            reports[index];


        if (
            report.status ===
            "COMPLETED"
        ) {

            alert(
                "This report is already completed."
            );

            return;
        }


        try {

            const cleanPhoto =
                await p3CompressImage(
                    file
                );


            const completedAt =
                Date.now();


            report.cleanPhoto =
                cleanPhoto;


            report.completedAt =
                completedAt;


            report.status =
                "COMPLETED";


            report.resolutionDays =
                p3ResolutionDays(
                    report.createdAt,
                    completedAt
                );


            reports[index] =
                report;


            if (
                !p3SaveReports(
                    reports
                )
            ) {
                return;
            }


            alert(
                `Report completed. Resolution time: ${report.resolutionDays} day(s).`
            );


            p3RenderCitizenReports();


        } catch (error) {

            console.error(
                "Report completion error:",
                error
            );


            alert(
                "Unable to save cleaned-place photo."
            );
        }
    }


    /* =====================================================
       15. RENDER ALL CITIZEN REPORTS
       ===================================================== */

    function p3RenderCitizenReports() {

        const container =
            p3Get(
                "citizenReportsList"
            );


        if (!container) {
            return;
        }


        const reports =
            p3LoadReports()
                .sort(
                    function (
                        a,
                        b
                    ) {

                        return (
                            Number(
                                b.createdAt
                            ) -
                            Number(
                                a.createdAt
                            )
                        );
                    }
                );


        if (!reports.length) {

            container.innerHTML = `

                <div class="
                    jd-no-citizen-reports
                ">

                    <div>
                        📋
                    </div>

                    <strong>
                        No citizen reports yet
                    </strong>

                    <span>
                        Submitted water-quality reports will appear here.
                    </span>

                </div>

            `;

            return;
        }


        container.innerHTML =
            reports
                .map(
                    function (
                        report
                    ) {

                        return p3ReportCard(
                            report
                        );
                    }
                )
                .join("");


        /*
         * Government clean-photo input events.
         */

        container
            .querySelectorAll(
                ".jd-clean-photo-input"
            )
            .forEach(
                function (
                    input
                ) {

                    input.addEventListener(
                        "change",
                        function () {

                            const file =
                                this.files &&
                                this.files[0];


                            const preview =
                                this
                                    .closest(
                                        ".jd-citizen-report-card"
                                    )
                                    ?.querySelector(
                                        ".jd-clean-photo-preview"
                                    );


                            if (
                                !file
                            ) {
                                return;
                            }


                            if (
                                !file.type.startsWith(
                                    "image/"
                                )
                            ) {

                                alert(
                                    "Please select an image."
                                );

                                this.value =
                                    "";

                                return;
                            }


                            if (
                                preview
                            ) {

                                const reader =
                                    new FileReader();


                                reader.onload =
                                    function () {

                                        preview.src =
                                            reader.result;

                                        preview.style.display =
                                            "block";
                                    };


                                reader.readAsDataURL(
                                    file
                                );
                            }
                        }
                    );
                }
            );


        /*
         * Complete buttons.
         */

        container
            .querySelectorAll(
                ".jd-complete-report-button"
            )
            .forEach(
                function (
                    button
                ) {

                    button.addEventListener(
                        "click",
                        function () {

                            const reportId =
                                this.dataset
                                    .reportId;


                            const card =
                                this.closest(
                                    ".jd-citizen-report-card"
                                );


                            const input =
                                card
                                    ? card.querySelector(
                                        ".jd-clean-photo-input"
                                    )
                                    : null;


                            const file =
                                input &&
                                input.files
                                    ? input.files[0]
                                    : null;


                            p3CompleteReport(
                                reportId,
                                file
                            );
                        }
                    );
                }
            );
    }


    function p3ReportCard(
        report
    ) {

        const completed =
            report.status ===
            "COMPLETED";


        const days =
            completed
                ? p3Num(
                    report.resolutionDays
                )
                : p3ResolutionDays(
                    report.createdAt,
                    null
                );


        const statusClass =
            completed
                ? "completed"
                : "pending";


        const cleanSection =
            completed

                ? `

                    <div class="
                        jd-report-clean-section
                    ">

                        <div class="
                            jd-report-section-title
                        ">
                            ✓ Cleaned Place
                        </div>

                        <img
                            class="
                                jd-report-photo
                            "
                            src="${p3Escape(
                                report.cleanPhoto
                            )}"
                            alt="
                                Cleaned place
                            ">

                        <div class="
                            jd-resolution-days
                        ">
                            Resolution time:
                            <strong>
                                ${days}
                                day${days === 1 ? "" : "s"}
                            </strong>
                        </div>

                        <div class="
                            jd-report-completed-date
                        ">
                            Completed:
                            ${p3DisplayDate(
                                report.completedAt
                            )}
                        </div>

                    </div>

                `

                : `

                    <div class="
                        jd-report-government-action
                    ">

                        <div class="
                            jd-report-section-title
                        ">
                            🏛️ Government Action
                        </div>


                        <label class="
                            jd-clean-photo-label
                        ">

                            Upload cleaned-place photo
                            <strong>
                                (Mandatory)
                            </strong>


                            <input
                                type="file"
                                accept="image/*"
                                class="
                                    jd-clean-photo-input
                                ">

                        </label>


                        <img
                            class="
                                jd-clean-photo-preview
                            "
                            alt="
                                Cleaned-place preview
                            ">


                        <button
                            type="button"
                            class="
                                jd-complete-report-button
                            "
                            data-report-id="${p3Escape(
                                report.id
                            )}">

                            Complete Report

                        </button>


                        <div class="
                            jd-pending-resolution
                        ">
                            Open for
                            <strong>
                                ${days}
                                day${days === 1 ? "" : "s"}
                            </strong>
                        </div>

                    </div>

                `;


        return `

            <article
                class="
                    jd-citizen-report-card
                    ${statusClass}
                ">


                <div class="
                    jd-report-card-header
                ">

                    <div>

                        <strong>
                            ${p3Escape(
                                report.id
                            )}
                        </strong>

                        <span>
                            ${p3DisplayDate(
                                report.createdAt
                            )}
                        </span>

                    </div>


                    <span class="
                        jd-report-status
                        ${statusClass}
                    ">

                        ${
                            completed
                                ? "COMPLETED"
                                : "PENDING"
                        }

                    </span>

                </div>


                <div class="
                    jd-report-body
                ">


                    <div class="
                        jd-report-information
                    ">

                        <div>
                            <strong>
                                Reporter
                            </strong>

                            <span>
                                ${p3Escape(
                                    report.reporter
                                )}
                            </span>
                        </div>


                        <div>
                            <strong>
                                Location
                            </strong>

                            <span>
                                📍
                                ${p3Escape(
                                    report.locationName
                                )}
                            </span>
                        </div>


                        <div>
                            <strong>
                                Coordinates
                            </strong>

                            <span>
                                ${p3Num(
                                    report.latitude
                                ).toFixed(5)},
                                ${p3Num(
                                    report.longitude
                                ).toFixed(5)}
                            </span>
                        </div>


                        <div>
                            <strong>
                                Problem
                            </strong>

                            <span>
                                ${p3Escape(
                                    report.description
                                )}
                            </span>
                        </div>

                    </div>


                    <div class="
                        jd-report-photo-section
                    ">

                        <div class="
                            jd-report-section-title
                        ">
                            📸 Dirty Place
                        </div>


                        <img
                            class="
                                jd-report-photo
                            "
                            src="${p3Escape(
                                report.dirtyPhoto
                            )}"
                            alt="
                                Citizen dirty-water report
                            ">

                    </div>


                    ${cleanSection}

                </div>

            </article>

        `;
    }


    /* =====================================================
       16. REFRESH REPORT BUTTON
       ===================================================== */

    function p3InitializeCitizenRefresh() {

        const button =
            p3Get(
                "refreshCitizenReports"
            );


        if (
            button &&
            button.dataset
                .jdReady !== "1"
        ) {

            button.dataset
                .jdReady = "1";


            button.addEventListener(
                "click",
                function () {

                    p3RenderCitizenReports();

                }
            );
        }
    }


    /* =====================================================
       17. SHARE REPORT
       ===================================================== */

    function p3InitializeShareButton() {

        const button =
            p3Get(
                "shareWaterReport"
            );


        if (
            !button ||
            button.dataset
                .jdReady === "1"
        ) {
            return;
        }


        button.dataset
            .jdReady = "1";


        button.addEventListener(
            "click",
            async function () {

                const description =
                    (
                        p3Get(
                            "reportDescription"
                        ) || {}
                    ).value ||
                    "";


                const text =
                    "JAL-DRISHTI AI Water Report\n\n" +
                    description;


                try {

                    if (
                        navigator.share
                    ) {

                        await navigator.share(
                            {
                                title:
                                    "JAL-DRISHTI AI Water Report",
                                text:
                                    text
                            }
                        );

                    } else if (
                        navigator.clipboard
                    ) {

                        await navigator.clipboard
                            .writeText(
                                text
                            );


                        alert(
                            "Report text copied."
                        );

                    } else {

                        alert(
                            text
                        );
                    }

                } catch (error) {

                    console.warn(
                        "Share cancelled/unavailable"
                    );
                }
            }
        );
    }


    /* =====================================================
       18. NAVIGATION → MAP RESIZE
       ===================================================== */

    function p3MapResizeWatcher() {

        if (!p3Map) {
            return;
        }


        setTimeout(
            function () {

                try {

                    p3Map.invalidateSize(
                        true
                    );

                } catch (error) {}

            },
            250
        );
    }


    document.addEventListener(
        "click",
        function (
            event
        ) {

            const target =
                event.target;


            if (!target) {
                return;
            }


            if (
                target.closest(
                    "nav"
                ) ||
                target.closest(
                    ".nav-item"
                ) ||
                target.closest(
                    "[data-section]"
                )
            ) {

                p3MapResizeWatcher();
            }
        }
    );


    /* =====================================================
       19. INITIALIZATION
       ===================================================== */

    function p3Initialize() {

        /*
         * Map
         */

        p3InitializeMap();

        p3CreateSearchSuggestions();

        p3InitializeMapButtons();


        /*
         * Citizen location
         */

        p3CreateCitizenLocationUI();

        p3PatchCitizenGPS();


        /*
         * Citizen photo
         */

        p3InitializeReportPhoto();


        /*
         * Citizen reports
         */

        p3InitializeCitizenSubmit();

        p3InitializeGovernmentResolution();

        p3InitializeCitizenRefresh();

        p3InitializeShareButton();


        /*
         * Render all previous reports.
         */

        p3RenderCitizenReports();


        /*
         * Give map time to calculate its dimensions.
         */

        setTimeout(
            function () {

                if (p3Map) {

                    try {
                        p3Map.invalidateSize(
                            true
                        );
                    } catch (error) {}

                }

            },
            1000
        );
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            p3Initialize,
            {
                once: true
            }
        );

    } else {

        p3Initialize();
    }


    /* =====================================================
       20. PUBLIC API
       ===================================================== */

    window.JAL_DRISHTI_FINAL_PATCH =
        window.JAL_DRISHTI_FINAL_PATCH ||
        {};


    window.JAL_DRISHTI_FINAL_PATCH.part3 = {

        initializeMap:
            p3InitializeMap,

        locateUser:
            p3LocateUser,

        searchPlace:
            p3SearchPlace,

        renderReports:
            p3RenderCitizenReports,

        setReportLocation:
            p3SetCitizenManualLocation

    };

})();
/* =========================================================
   JAL-DRISHTI AI
   LIVE SENSOR READINGS FROM FIREBASE REALTIME DATABASE
   ONLY LIVE READING — NO OTHER WEBSITE CHANGES
   ========================================================= */

(function startLiveSensorReadingsOnly() {

    const LIVE_SENSOR_URL =
        "https://civil-aqua-jal-drishti-ai-default-rtdb.asia-southeast1.firebasedatabase.app/sensors.json";

    let previousLiveValues = {};

    function setLiveValue(id, value, decimals = null) {
        const element = document.getElementById(id);

        if (!element || value === undefined || value === null) {
            return;
        }

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return;
        }

        if (decimals !== null) {
            element.textContent = number.toFixed(decimals);
        } else {
            element.textContent = String(number);
        }
    }

    function updateLiveSensorValues(data) {

        if (!data || typeof data !== "object") {
            return;
        }
        window.liveSensorData = {
    ...(window.liveSensorData || {}),
    ...data
};
        if (typeof sensors !== "undefined" && sensors) {
            console.log("SENSORS OBJECT:", sensors);

    sensors.ph =
        data.ph ??
        data.pH ??
        data.PH ??
        sensors.ph;

    sensors.turbidity =
        data.turbidity ??
        sensors.turbidity;

    sensors.tds =
        data.tds ??
        sensors.tds;

    sensors.temperature =
        data.temperature ??
        sensors.temperature;

    sensors.waterLevel =
        data.waterLevel ??
        sensors.waterLevel;

    sensors.rainfall =
        data.rain ??
        sensors.rainfall;

    sensors.do =
        data.DO ??
        data.dissolvedOxygen ??
        data.dissolved_oxygen ??
        sensors.do;
}

        /* pH */
        if (data.ph !== undefined ||
            data.pH !== undefined ||
            data.PH !== undefined) {

            const value =
                data.ph ??
                data.pH ??
                data.PH;

            setLiveValue("phValue", value, 2);
        }

        /* Turbidity */
        if (data.turbidity !== undefined) {
            setLiveValue("turbidityValue", data.turbidity, 0);
        }

        /* TDS */
        if (data.tds !== undefined) {
            setLiveValue("tdsValue", data.tds, 0);
        }

        /* Water Temperature */
        if (data.temperature !== undefined) {
            setLiveValue("temperatureValue", data.temperature, 2);
        }

        /* Water Level */
        if (data.waterLevel !== undefined) {
            setLiveValue("waterLevelValue", data.waterLevel, 0);
        }

        /* Rainfall */
        if (data.rain !== undefined) {
            setLiveValue("rainfallValue", data.rain, 1);
        }

        /* Dissolved Oxygen */
        if (data.DO !== undefined ||
            data.dissolvedOxygen !== undefined ||
            data.dissolved_oxygen !== undefined) {

            const value =
                data.DO ??
                data.dissolvedOxygen ??
                data.dissolved_oxygen;

            setLiveValue("doValue", value, 2);
            /* =========================================================
   LIVE WATER FINGERPRINT
   ========================================================= */

function jdFingerprintBar(id, value, maxValue) {
    const bar = document.getElementById(id);

    if (!bar) return;

    const number = Number(value);

    if (!Number.isFinite(number)) return;

    const percentage = Math.max(
        0,
        Math.min(100, (number / maxValue) * 100)
    );

    bar.style.width = percentage + "%";
}

function jdFingerprintValue(id, value, unit, decimals) {
    const element = document.getElementById(id);

    if (!element) return;

    const number = Number(value);

    if (!Number.isFinite(number)) return;

    element.textContent =
        number.toFixed(decimals) + unit;
}


/* pH */
const livePH =
    data.ph ??
    data.pH ??
    data.PH;

if (livePH !== undefined) {

    jdFingerprintBar(
        "phFingerprint",
        livePH,
        14
    );

    jdFingerprintValue(
        "phFingerprintValue",
        livePH,
        "",
        2
    );
}


/* Turbidity */
if (data.turbidity !== undefined) {

    jdFingerprintBar(
        "turbidityFingerprint",
        data.turbidity,
        1000
    );

    jdFingerprintValue(
        "turbidityFingerprintValue",
        data.turbidity,
        " NTU",
        0
    );
}


/* TDS */
if (data.tds !== undefined) {

    jdFingerprintBar(
        "tdsFingerprint",
        data.tds,
        1000
    );

    jdFingerprintValue(
        "tdsFingerprintValue",
        data.tds,
        " ppm",
        0
    );
}


/* Temperature */
if (data.temperature !== undefined) {

    jdFingerprintBar(
        "temperatureFingerprint",
        data.temperature,
        50
    );

    jdFingerprintValue(
        "temperatureFingerprintValue",
        data.temperature,
        " °C",
        2
    );
}


/* Dissolved Oxygen */
const liveDO =
    data.DO ??
    data.dissolvedOxygen ??
    data.dissolved_oxygen;

if (liveDO !== undefined) {

    jdFingerprintBar(
        "doFingerprint",
        liveDO,
        10
    );

    jdFingerprintValue(
        "doFingerprintValue",
        liveDO,
        " mg/L",
        2
    );
}
        }

        /* Optional trend update */
        const trendMap = {
            ph: "phTrend",
            turbidity: "turbidityTrend",
            tds: "tdsTrend",
            temperature: "temperatureTrend",
            waterLevel: "waterLevelTrend",
            rain: "rainfallTrend",
            DO: "doTrend"
        };

        Object.keys(trendMap).forEach(function(key) {

            let current = data[key];

            if (current === undefined) {
                return;
            }

            current = Number(current);

            if (!Number.isFinite(current)) {
                return;
            }

            const old = previousLiveValues[key];

            let trend = "→ Stable";

            if (old !== undefined) {
                if (current > old) {
                    trend = "↑ Increasing";
                } else if (current < old) {
                    trend = "↓ Decreasing";
                }
            }

            const trendElement =
                document.getElementById(trendMap[key]);

            if (trendElement) {
                trendElement.textContent = trend;
            }

            previousLiveValues[key] = current;
        });
    }

    async function fetchLiveSensorData() {

        try {

            const response = await fetch(
                LIVE_SENSOR_URL + "?t=" + Date.now(),
                {
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Firebase HTTP " + response.status
                );
            }

            const data = await response.json();

            updateLiveSensorValues(data);

            console.log(
                "JAL-DRISHTI AI LIVE SENSOR DATA:",
                data
            );

        } catch (error) {

            console.warn(
                "Live sensor reading error:",
                error
            );
        }
    }

    /* First reading immediately */
    fetchLiveSensorData();

    /* Keep website LIVE */
    setInterval(
        fetchLiveSensorData,
        500
    );

})();