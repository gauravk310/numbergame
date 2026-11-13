"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Trophy,
  Sparkles,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Timer as TimerIcon,
  HelpCircle,
  ArrowRight,
  Flame,
} from "lucide-react";
import { sound } from "@/utils/sound";

const RANGE_OPTIONS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

type GameStatus = "idle" | "playing" | "won";

export default function OrderlyGame() {
  const [range, setRange] = useState<number>(20);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const [nextExpected, setNextExpected] = useState<number>(1);
  const [correctSet, setCorrectSet] = useState<Set<number>>(new Set());
  const [wrongSelected, setWrongSelected] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [bestTimes, setBestTimes] = useState<Record<number, number>>({});
  const [isRangeOpen, setIsRangeOpen] = useState<boolean>(false);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load high scores from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("orderly_best_times");
      if (saved) {
        setBestTimes(JSON.parse(saved));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Sync sound manager enabled state
  useEffect(() => {
    sound.enabled = soundEnabled;
  }, [soundEnabled]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsRangeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Shuffle array using Fisher-Yates
  const shuffle = useCallback((array: number[]): number[] => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, []);

  // Initialize or reset board
  const initializeBoard = useCallback(
    (n: number) => {
      const arr = Array.from({ length: n }, (_, i) => i + 1);
      setNumbers(shuffle(arr));
      setCorrectSet(new Set());
      setWrongSelected(null);
      setNextExpected(1);
      setElapsedMs(0);
      setMistakes(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    [shuffle]
  );

  // When range changes, re-init board
  useEffect(() => {
    initializeBoard(range);
    setGameStatus("idle");
  }, [range, initializeBoard]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Start game action without reshuffling board
  const handleStartGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameStatus("playing");
    setCorrectSet(new Set());
    setWrongSelected(null);
    setNextExpected(1);
    setMistakes(0);
    setElapsedMs(0);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 50);
  };

  // Restart / Reset action (reshuffles for a fresh board)
  const handleReset = () => {
    initializeBoard(range);
    setGameStatus("idle");
  };

  // Victory handler
  const handleWin = useCallback(
    (finalTime: number) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setGameStatus("won");
      sound.playWin();

      // Trigger multi-angle confetti
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#e08b68", "#4ade80", "#f59e0b", "#6ee7b7", "#ffffff"],
        });
        setTimeout(() => {
          confetti({
            particleCount: 60,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ["#e08b68", "#4ade80", "#38bdf8"],
          });
          confetti({
            particleCount: 60,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ["#e08b68", "#4ade80", "#38bdf8"],
          });
        }, 250);
      } catch {
        // Confetti fallback
      }

      // Check personal best
      const currentBest = bestTimes[range];
      if (!currentBest || finalTime < currentBest) {
        const updated = { ...bestTimes, [range]: finalTime };
        setBestTimes(updated);
        try {
          localStorage.setItem("orderly_best_times", JSON.stringify(updated));
        } catch {
          // Ignore
        }
      }
    },
    [bestTimes, range]
  );

  // Handle Box Click
  const handleBoxClick = (num: number) => {
    // If game not yet started, start timer without reshuffling board
    if (gameStatus === "idle") {
      setGameStatus("playing");
      setElapsedMs(0);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 50);
    }

    if (gameStatus !== "playing" && gameStatus !== "idle") return;

    // If this number is already correctly selected, ignore
    if (correctSet.has(num)) {
      return;
    }

    // If there is currently a wrong selected box:
    if (wrongSelected !== null) {
      if (num === wrongSelected) {
        // User clicked again on the same wrong box -> UNSELECT it!
        setWrongSelected(null);
        sound.playUnselect();
      } else {
        // Must unselect the wrong one first!
        sound.playWrong();
      }
      return;
    }

    // Check if clicked number matches nextExpected
    if (num === nextExpected) {
      // CORRECT!
      const newCorrect = new Set(correctSet);
      newCorrect.add(num);
      setCorrectSet(newCorrect);
      sound.playCorrect();

      const nextNum = nextExpected + 1;
      setNextExpected(nextNum);

      if (newCorrect.size === range) {
        // GAME OVER - VICTORY!
        const finalTime = Date.now() - startTimeRef.current;
        setElapsedMs(finalTime);
        handleWin(finalTime);
      }
    } else {
      // WRONG ORDER!
      setWrongSelected(num);
      setMistakes((prev) => prev + 1);
      sound.playWrong();
    }
  };

  // Format milliseconds into MM:SS.S
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
  };

  // Square format grid calculation: keep cols and rows balanced as a square
  const getGridConfig = (n: number) => {
    switch (n) {
      case 5:
        // 5 numbers in 5 cols (single row) or 3 cols
        return { cols: "grid-cols-5", maxW: "max-w-md", text: "text-2xl sm:text-3xl" };
      case 10:
        // 5 cols x 2 rows
        return { cols: "grid-cols-5", maxW: "max-w-md", text: "text-xl sm:text-2xl" };
      case 20:
        // 5 cols x 4 rows -> almost square
        return { cols: "grid-cols-5", maxW: "max-w-md", text: "text-lg sm:text-xl" };
      case 30:
        // 6 cols x 5 rows -> almost square (30 boxes)
        return { cols: "grid-cols-6", maxW: "max-w-lg", text: "text-base sm:text-lg" };
      case 40:
        // 7 cols x 6 rows (42 capacity)
        return { cols: "grid-cols-7", maxW: "max-w-lg", text: "text-sm sm:text-base" };
      case 50:
        // 7 cols or 8 cols (7x7=49, so 8 cols x 7 rows)
        return { cols: "grid-cols-8", maxW: "max-w-xl", text: "text-xs sm:text-sm" };
      case 60:
        // 8 cols x 8 rows
        return { cols: "grid-cols-8", maxW: "max-w-xl", text: "text-xs sm:text-sm" };
      case 70:
        // 9 cols x 8 rows
        return { cols: "grid-cols-9", maxW: "max-w-xl", text: "text-xs sm:text-sm" };
      case 80:
        // 9 cols x 9 rows (81 capacity)
        return { cols: "grid-cols-9", maxW: "max-w-xl", text: "text-xs sm:text-sm" };
      case 90:
        // 10 cols x 9 rows
        return { cols: "grid-cols-10", maxW: "max-w-2xl", text: "text-[11px] sm:text-xs" };
      case 100:
        // 10 cols x 10 rows -> perfect 10x10 square!
        return { cols: "grid-cols-10", maxW: "max-w-2xl", text: "text-[11px] sm:text-xs" };
      default:
        return { cols: "grid-cols-5", maxW: "max-w-md", text: "text-sm sm:text-base" };
    }
  };

  const gridConfig = getGridConfig(range);
  const progressPercent = Math.round((correctSet.size / range) * 100);

  return (
    <div className="ambient-bg min-h-screen text-[#edebe6] flex flex-col justify-start selection:bg-[#e08b68] selection:text-black relative">
      {/* 1. TOP NAVBAR: Title, tagline, and utility controls */}
      <nav className="w-full border-b border-white/5 bg-[#0d1211]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-[#f5efe6]">
              Orderly
            </h1>
            <span className="hidden sm:inline-block text-[11px] px-2.5 py-0.5 rounded-full glass-pill text-[#a3a8a5] tracking-wide">
              focus & speed
            </span>
          </div>

          {/* Right navbar controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHowToPlay(true)}
              className="px-3 py-1.5 rounded-full glass-pill hover:bg-white/10 text-xs text-[#a0a9a4] hover:text-[#f0f0f0] transition-colors flex items-center gap-1.5 border border-white/10"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#e08b68]" />
              <span className="hidden sm:inline">How to play</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
              className="w-8 h-8 rounded-full glass-pill hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center text-[#d6ded9] border border-white/10"
              title={soundEnabled ? "Sound on" : "Sound muted"}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#e08b68]" />
              ) : (
                <VolumeX className="w-4 h-4 text-[#727a76]" />
              )}
            </button>

            {bestTimes[range] && (
              <div
                className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full glass-pill text-xs text-[#a3ada7] border border-white/10"
                title={`Best record for 1-${range}`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono text-[#e4ede8]">
                  {formatTime(bestTimes[range])}
                </span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="w-full max-w-4xl mx-auto px-4 pt-4 pb-12 flex flex-col items-center">
        {/* 2. SUB-ROW: Range Dropdown at LEFT, Start/Restart & Timer at RIGHT on SAME ROW */}
        <div className="w-full max-w-2xl flex items-center justify-between gap-3 mb-4">
          {/* Left: Range Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsRangeOpen(!isRangeOpen)}
              className="glass-pill hover:bg-white/[0.08] active:scale-95 transition-all text-xs sm:text-sm px-4 py-2.5 rounded-full flex items-center gap-2 border border-white/10 text-[#edebe6] shadow-sm font-medium"
              aria-expanded={isRangeOpen}
            >
              <span>Range: {range}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#8c9490] transition-transform duration-200 ${
                  isRangeOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isRangeOpen && (
              <div className="absolute top-full mt-2 left-0 w-44 py-2 rounded-2xl glass-panel shadow-2xl z-30 border border-white/15 backdrop-blur-xl">
                <div className="px-3 py-1 text-[10px] font-semibold text-[#8c9490] uppercase tracking-wider border-b border-white/10 mb-1">
                  Select Range
                </div>
                <div className="max-h-72 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-1 space-y-0.5">
                  {RANGE_OPTIONS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setRange(val);
                        setIsRangeOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        range === val
                          ? "bg-[#e08b68] text-stone-950 font-bold"
                          : "text-[#d8deda] hover:bg-white/10"
                      }`}
                    >
                      <span>1 to {val}</span>
                      {bestTimes[val] && (
                        <span className="text-[10px] font-mono opacity-80">
                          {formatTime(bestTimes[val])}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Start / Restart & Timer Pill on the same row */}
          <div className="flex items-center gap-2">
            {gameStatus === "idle" ? (
              <button
                type="button"
                onClick={handleStartGame}
                className="px-5 py-2.5 rounded-full bg-[#e08b68] hover:bg-[#d87c57] text-stone-950 font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-orange-950/30 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 rounded-full bg-[#e08b68] hover:bg-[#d87c57] text-stone-950 font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-orange-950/30 transition-all active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>
            )}

            {/* Timer pill */}
            <div className="px-4 py-2.5 rounded-full glass-pill flex items-center gap-2 text-xs sm:text-sm font-mono text-[#d6ded9] border border-white/10 shadow-sm">
              <TimerIcon className="w-3.5 h-3.5 text-[#e08b68]" />
              <span>{formatTime(elapsedMs)}</span>
            </div>
          </div>
        </div>

        {/* 3. CENTER STATUS & PROGRESS BAR LINE */}
        <div className="w-full max-w-2xl flex flex-col items-center text-center my-2">
          {/* Subtle status label */}
          <div className="text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] text-[#e08b68] uppercase mb-1">
            {gameStatus === "idle" && "READY"}
            {gameStatus === "playing" && (wrongSelected !== null ? "ATTENTION" : "FIND NEXT")}
            {gameStatus === "won" && "EXCELLENT"}
          </div>

          {/* Large target number display */}
          <div className="min-h-[3rem] flex items-center justify-center">
            {gameStatus === "idle" && (
              <h2 className="font-serif text-3xl sm:text-4xl text-[#f5efe6] font-normal tracking-tight">
                Click Start or Tap 1
              </h2>
            )}

            {gameStatus === "playing" && wrongSelected === null && (
              <div className="flex items-center gap-3">
                <span className="font-serif text-4xl sm:text-5xl text-[#f5efe6] font-normal tracking-tight">
                  {nextExpected}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-[#8c9490] border border-white/10 px-2 py-0.5 rounded-full font-mono">
                  {correctSet.size}/{range}
                </span>
              </div>
            )}

            {gameStatus === "playing" && wrongSelected !== null && (
              <span className="font-serif text-2xl sm:text-3xl text-rose-300 font-normal tracking-tight">
                Tap box {wrongSelected} to unselect
              </span>
            )}

            {gameStatus === "won" && (
              <h2 className="font-serif text-3xl sm:text-4xl text-emerald-300 font-normal tracking-tight">
                Completed!
              </h2>
            )}
          </div>

          {/* Center Progress Bar Line */}
          <div className="w-full max-w-md h-1.5 bg-white/10 rounded-full my-2 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#e08b68] to-emerald-400 transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Contextual Warning Pill */}
          {wrongSelected !== null && (
            <div className="mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-medium animate-pulse">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Out of order! Tap red box [{wrongSelected}] again to unselect.</span>
            </div>
          )}
        </div>

        {/* 4. NUMBER GRID: Center-aligned, square grid format */}
        <main className="w-full flex justify-center items-center mt-3">
          <div
            className={`w-full ${gridConfig.maxW} grid ${gridConfig.cols} gap-2 sm:gap-2.5 p-3 sm:p-4 rounded-3xl glass-panel shadow-2xl transition-all`}
          >
            {numbers.map((num) => {
              const isCorrect = correctSet.has(num);
              const isWrong = wrongSelected === num;
              const isOtherBlocked = wrongSelected !== null && !isWrong;

              // Consistent border-2 and zero scale to lock position
              let stateClasses =
                "bg-white/[0.04] border-2 border-white/10 text-[#edebe6] hover:bg-white/[0.08] hover:border-white/25 cursor-pointer";

              if (isCorrect) {
                // Light green styling
                stateClasses =
                  "bg-emerald-500/25 border-2 border-emerald-400 text-emerald-200 font-bold shadow-[0_0_15px_rgba(52,211,153,0.3)] cursor-default";
              } else if (isWrong) {
                // Light red styling
                stateClasses =
                  "bg-rose-500/30 border-2 border-rose-400 text-rose-100 font-bold shadow-[0_0_20px_rgba(244,63,94,0.4)] cursor-pointer";
              } else if (isOtherBlocked) {
                stateClasses =
                  "bg-white/[0.02] border-2 border-white/5 text-[#5f6864] cursor-not-allowed opacity-40";
              }

              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleBoxClick(num)}
                  aria-label={`Number ${num}${isCorrect ? ", correct" : isWrong ? ", wrong, click to unselect" : ""}`}
                  className={`aspect-square w-full relative rounded-xl sm:rounded-2xl flex items-center justify-center font-mono font-medium transition-colors duration-150 select-none ${gridConfig.text} ${stateClasses}`}
                >
                  <span className="pointer-events-none">{num}</span>

                  {/* Indicators */}
                  {isCorrect && (
                    <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 absolute top-1 right-1 sm:top-1.5 sm:right-1.5 opacity-70 pointer-events-none" />
                  )}

                  {isWrong && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] sm:text-[9px] font-sans font-bold px-1.5 rounded-full shadow-md pointer-events-none">
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </main>
      </div>

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="glass-panel max-w-md w-full p-6 sm:p-7 rounded-3xl border border-white/15 shadow-2xl relative">
            <div className="flex items-center gap-2 text-[#e08b68] text-xs font-semibold uppercase tracking-widest mb-1">
              Game Guide
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl text-[#f5efe6] font-normal mb-4">
              How to Play
            </h3>

            <div className="space-y-3 text-xs sm:text-sm text-[#b0bab4] leading-relaxed mb-6 font-light">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#e08b68]/20 text-[#e08b68] flex items-center justify-center text-xs font-mono font-bold shrink-0">
                  1
                </div>
                <div>
                  <strong className="text-[#edebe6] font-medium">Choose Range:</strong> Select
                  any number from 5 to 100 via the top-left dropdown.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#e08b68]/20 text-[#e08b68] flex items-center justify-center text-xs font-mono font-bold shrink-0">
                  2
                </div>
                <div>
                  <strong className="text-[#edebe6] font-medium">Start:</strong> Click{" "}
                  <span className="text-[#e08b68] font-medium">Start</span> or tap box 1 directly.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                  3
                </div>
                <div>
                  <strong className="text-[#edebe6] font-medium">Order 1, 2, 3 ... N:</strong> Tap
                  numbers in ascending order. Correct selections turn{" "}
                  <span className="text-emerald-300 font-medium">light green</span>.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                  4
                </div>
                <div>
                  <strong className="text-[#edebe6] font-medium">Unselect Mistakes:</strong> Out of
                  order numbers turn <span className="text-rose-300 font-medium">light red</span>.
                  Tap that same red box again to unselect it before continuing.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                  5
                </div>
                <div>
                  <strong className="text-[#edebe6] font-medium">Victory:</strong> Selecting the
                  last number stops the timer and saves your personal best score!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHowToPlay(false)}
              className="w-full py-2.5 rounded-full bg-[#e08b68] hover:bg-[#d87c57] text-stone-950 font-semibold text-xs sm:text-sm transition-all"
            >
              Got it, let&apos;s play!
            </button>
          </div>
        </div>
      )}

      {/* Victory Celebration Modal */}
      {gameStatus === "won" && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="glass-panel max-w-sm w-full p-6 sm:p-7 rounded-3xl border border-white/20 shadow-2xl text-center relative">
            <div className="w-14 h-14 rounded-full bg-[#e08b68]/20 border border-[#e08b68]/40 mx-auto flex items-center justify-center mb-3">
              <Trophy className="w-7 h-7 text-[#e08b68]" />
            </div>

            <div className="text-[10px] font-semibold tracking-widest text-[#e08b68] uppercase mb-1">
              Puzzle Completed
            </div>

            <h3 className="font-serif text-3xl sm:text-4xl text-[#f5efe6] font-normal mb-1">
              Outstanding!
            </h3>

            <p className="text-xs text-[#8c9490] mb-5 font-light">
              You cleared 1 to {range} in correct order.
            </p>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              <div className="p-3 rounded-2xl glass-pill border border-white/10">
                <div className="text-[10px] uppercase text-[#8c9490] tracking-wider mb-0.5">
                  Final Time
                </div>
                <div className="font-mono text-xl text-[#f5efe6] font-bold">
                  {formatTime(elapsedMs)}
                </div>
              </div>

              <div className="p-3 rounded-2xl glass-pill border border-white/10">
                <div className="text-[10px] uppercase text-[#8c9490] tracking-wider mb-0.5">
                  Mistakes
                </div>
                <div
                  className={`font-mono text-xl font-bold ${
                    mistakes === 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {mistakes === 0 ? "Flawless" : mistakes}
                </div>
              </div>
            </div>

            {/* Best time tag */}
            {bestTimes[range] && elapsedMs <= bestTimes[range] && (
              <div className="mb-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
                <Flame className="w-3.5 h-3.5" />
                <span>New Personal Record!</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleStartGame}
                className="w-full py-2.5 rounded-full bg-[#e08b68] hover:bg-[#d87c57] text-stone-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-950/40 active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>

              {range < 100 && (
                <button
                  type="button"
                  onClick={() => {
                    const currentIndex = RANGE_OPTIONS.indexOf(range);
                    if (currentIndex !== -1 && currentIndex + 1 < RANGE_OPTIONS.length) {
                      setRange(RANGE_OPTIONS[currentIndex + 1]);
                    }
                  }}
                  className="w-full py-2.5 rounded-full glass-pill hover:bg-white/10 text-[#edebe6] font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>Next Level ({RANGE_OPTIONS[RANGE_OPTIONS.indexOf(range) + 1]})</span>
                  <ArrowRight className="w-4 h-4 text-[#e08b68]" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
