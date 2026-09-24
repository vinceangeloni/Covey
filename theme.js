            /*
             * Covey theme bootstrap.
             *
             * This file is loaded synchronously in the document head so the
             * saved palette, color mode, and text size are applied before the
             * page is painted. The public GT object is consumed by app.js for
             * runtime theme changes and appearance settings.
             */
            window.GT = (function () {
                // Each palette supplies CSS custom-property values for both modes.
                var T = {
                    sand: {
                        n: "Sand",
                        light: {
                            bg: "#f4efe8",
                            card: "#ffffff",
                            ink: "#2b2622",
                            mute: "#8a8178",
                            line: "#e8e2d9",
                            accent: "#c8553d",
                            on: "#ffffff",
                        },
                        dark: {
                            bg: "#151211",
                            card: "#26221f",
                            ink: "#f5f0ea",
                            mute: "#a39b92",
                            line: "#3b3632",
                            accent: "#e2725b",
                            on: "#1f1612",
                        },
                    },
                    ocean: {
                        n: "Ocean",
                        light: {
                            bg: "#e8f1f6",
                            card: "#ffffff",
                            ink: "#1d2b36",
                            mute: "#6b8090",
                            line: "#d5e2ea",
                            accent: "#2a749c",
                            on: "#ffffff",
                        },
                        dark: {
                            bg: "#0e1a22",
                            card: "#17262f",
                            ink: "#e8f2f8",
                            mute: "#8fa7b6",
                            line: "#28404d",
                            accent: "#4fb0dc",
                            on: "#0b1820",
                        },
                    },
                    forest: {
                        n: "Forest",
                        light: {
                            bg: "#edf2ea",
                            card: "#ffffff",
                            ink: "#1f2a1f",
                            mute: "#71806f",
                            line: "#dbe4d7",
                            accent: "#3f7d4e",
                            on: "#ffffff",
                        },
                        dark: {
                            bg: "#0f1811",
                            card: "#182319",
                            ink: "#ecf4ec",
                            mute: "#8fa58f",
                            line: "#2b3d2d",
                            accent: "#6bc17f",
                            on: "#0f1a12",
                        },
                    },
                    blossom: {
                        n: "Blossom",
                        light: {
                            bg: "#f8eef1",
                            card: "#ffffff",
                            ink: "#2e2226",
                            mute: "#8f7a82",
                            line: "#efdde3",
                            accent: "#c2456f",
                            on: "#ffffff",
                        },
                        dark: {
                            bg: "#1a1014",
                            card: "#2a1a20",
                            ink: "#f8ecf0",
                            mute: "#b09aa3",
                            line: "#4a2f39",
                            accent: "#ee7fa0",
                            on: "#22101a",
                        },
                    },
                    slate: {
                        n: "Slate",
                        light: {
                            bg: "#eceff4",
                            card: "#ffffff",
                            ink: "#1e2430",
                            mute: "#6b7488",
                            line: "#dbe0ea",
                            accent: "#4f5bd5",
                            on: "#ffffff",
                        },
                        dark: {
                            bg: "#0f1218",
                            card: "#191e28",
                            ink: "#eef1f7",
                            mute: "#8b94a8",
                            line: "#2c3444",
                            accent: "#8a94f0",
                            on: "#0f1220",
                        },
                    },
                    amber: {
                        n: "Amber",
                        light: {
                            bg: "#faf0e0",
                            card: "#ffffff",
                            ink: "#2d2416",
                            mute: "#8c7a5e",
                            line: "#efe0c4",
                            accent: "#b5650a",
                            on: "#ffffff",
                        },
                        dark: {
                            bg: "#17110a",
                            card: "#251b10",
                            ink: "#faf0e0",
                            mute: "#b09b7a",
                            line: "#443421",
                            accent: "#f0a13a",
                            on: "#1c1206",
                        },
                    },
                };
                // Apply a palette and mode directly to the document root.
                function apply(p, m) {
                    var t = T[T.hasOwnProperty(p) ? p : "sand"][m],
                        r = document.documentElement;
                    for (var k in t) r.style.setProperty("--" + k, t[k]);
                    r.dataset.theme = m;
                }
                function mm(x) {
                    var a = x.split(":");
                    return +a[0] * 60 + +a[1];
                }
                // Resolve an overnight or same-day dark-mode schedule.
                function sched(f, t, d) {
                    d = d || new Date();
                    var n = d.getHours() * 60 + d.getMinutes(),
                        a = mm(f),
                        b = mm(t);
                    return (a > b ? n >= a || n < b : n >= a && n < b)
                        ? "dark"
                        : "light";
                }
                // Read persisted appearance preferences defensively; storage can
                // be unavailable in private browsing or restricted environments.
                var s = {},
                    man = null;
                try {
                    s = JSON.parse(
                        localStorage.getItem("gaggle-settings") || "{}",
                    );
                } catch (e) {}
                try {
                    man = localStorage.getItem("gaggle-theme");
                } catch (e) {}
                var sys = matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light";
                var TX = { sm: 14, md: 16, lg: 18, xl: 20 };
                // Text size is represented as the root font size so rem-based UI
                // and the calendar layout scale together.
                function setText(k) {
                    document.documentElement.style.fontSize =
                        (TX.hasOwnProperty(k) ? TX[k] : 16) + "px";
                }
                setText(s.text);
                var re = /^\d\d:\d\d$/;
                apply(
                    s.palette || "sand",
                    s.auto
                        ? sched(
                              re.test(s.darkFrom) ? s.darkFrom : "19:00",
                              re.test(s.darkTo) ? s.darkTo : "07:00",
                          )
                        : man === "light" || man === "dark"
                          ? man
                          : sys,
                );
                return {
                    T: T,
                    TX: TX,
                    apply: apply,
                    sched: sched,
                    setText: setText,
                };
            })();
