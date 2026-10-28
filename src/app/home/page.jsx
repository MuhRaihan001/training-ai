"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";

const APP_NAME = "Training Ai Playground";

const NAV_LINKS = [
    { href: "/training", label: "Training" },
    { href: "/test", label: "Tes Model" },
];

const BASE_COLOR = "250, 250, 249"; 
const STRANDS = 90;
const SEGMENTS = 48;
const STRAND_ALPHA = 0.42;
const DESKTOP_MIN_WIDTH = 1024;
const PATH_DESKTOP = [
    [0.56, -0.1],
    [0.44, 0.38],
    [1.02, 0.42],
    [0.86, 1.12],
];
const PATH_MOBILE = [
    [-0.1, 0.92],
    [0.3, 0.5],
    [0.7, 1.02],
    [1.1, 0.58],
];

const RIBBONS = [
    {
        stops: ["#6aa8ff", "#8b7bff", "#c46bff", "#ff6fb0"],
        phase: 0,
        widthScale: 1,
        shift: [0, 0],
    },
    {
        stops: ["#ff6fb0", "#ff8a4c", "#ffb347"],
        phase: 2.1,
        widthScale: 0.75,
        shift: [0.1, 0.02],
    },
];

const focusClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50";

function hexToRgb(hex) {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function colorAt(stops, position) {
    const scaled = position * (stops.length - 1);
    const index = Math.min(Math.floor(scaled), stops.length - 2);
    const local = scaled - index;
    const from = hexToRgb(stops[index]);
    const to = hexToRgb(stops[index + 1]);

    return from.map((channel, i) => Math.round(channel + (to[i] - channel) * local));
}

function cubic(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function cubicDerivative(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

function RibbonBackground() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        const strandColors = RIBBONS.map((ribbon) =>
            Array.from({ length: STRANDS }, (_, j) =>
                colorAt(ribbon.stops, j / (STRANDS - 1)).join(", ")
            )
        );

        let width = 0;
        let height = 0;
        let frameId = 0;

        function buildSpine(ribbon, path, baseWidth, time) {
            const xs = path.map((p) => p[0] + ribbon.shift[0]);
            const ys = path.map((p) => p[1] + ribbon.shift[1]);
            const spine = [];

            for (let i = 0; i <= SEGMENTS; i++) {
                const t = i / SEGMENTS;

                const cx = cubic(xs[0], xs[1], xs[2], xs[3], t) * width;
                const cy = cubic(ys[0], ys[1], ys[2], ys[3], t) * height;
                const dx = cubicDerivative(xs[0], xs[1], xs[2], xs[3], t) * width;
                const dy = cubicDerivative(ys[0], ys[1], ys[2], ys[3], t) * height;
                const length = Math.hypot(dx, dy) || 1;
                const nx = -dy / length;
                const ny = dx / length;

                const twist = Math.abs(
                    Math.sin(t * Math.PI * 1.5 + ribbon.phase + time * 0.00015)
                );
                const spread = baseWidth * ribbon.widthScale * (0.22 + 0.78 * twist);
                const sway =
                    Math.sin(t * 5 + ribbon.phase + time * 0.0004) * baseWidth * 0.05;

                spine.push({
                    x: cx + nx * sway,
                    y: cy + ny * sway,
                    nx,
                    ny,
                    spread,
                    t,
                });
            }

            return spine;
        }

        function render(time) {
            const isDesktop = width >= DESKTOP_MIN_WIDTH;
            const path = isDesktop ? PATH_DESKTOP : PATH_MOBILE;
            const baseWidth = Math.min(width, height) * (isDesktop ? 0.62 : 0.55);

            ctx.clearRect(0, 0, width, height);
            ctx.lineWidth = 1.3;

            RIBBONS.forEach((ribbon, r) => {
                const spine = buildSpine(ribbon, path, baseWidth, time);

                for (let j = 0; j < STRANDS; j++) {
                    const s = j / (STRANDS - 1) - 0.5;

                    ctx.strokeStyle = `rgba(${strandColors[r][j]}, ${STRAND_ALPHA})`;
                    ctx.beginPath();

                    spine.forEach((point, i) => {
                        const ripple = Math.sin(point.t * 9 + s * 4 + time * 0.0006) * 2;
                        const offset = s * point.spread + ripple;
                        const x = point.x + point.nx * offset;
                        const y = point.y + point.ny * offset;

                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    });

                    ctx.stroke();
                }
            });
        }

        function frame(time) {
            render(time);
            frameId = requestAnimationFrame(frame);
        }

        function resize() {
            const dpr = window.devicePixelRatio || 1;

            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            if (reduceMotion) render(0);
        }

        const observer = new ResizeObserver(resize);
        observer.observe(canvas);

        if (!reduceMotion) frameId = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(frameId);
            observer.disconnect();
        };
    }, []);
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-72 lg:inset-y-0 lg:h-auto"
        >
            <canvas ref={canvasRef} className="h-full w-full" />

            <div
                className="absolute inset-0 lg:hidden"
                style={{
                    background: `linear-gradient(to bottom, rgb(${BASE_COLOR}) 0%, rgba(${BASE_COLOR}, 0.9) 25%, rgba(${BASE_COLOR}, 0) 70%)`,
                }}
            />
            <div
                className="absolute inset-0 hidden lg:block"
                style={{
                    background: `linear-gradient(to right, rgb(${BASE_COLOR}) 0%, rgb(${BASE_COLOR}) 46%, rgba(${BASE_COLOR}, 0) 70%)`,
                }}
            />
        </div>
    );
}

function Navbar() {
    return (
        <header className="relative z-20 border-b border-stone-200 bg-stone-50/80 backdrop-blur">
            <nav
                aria-label="Navigasi utama"
                className="mx-auto flex h-14 w-full max-w-6xl items-center px-5 sm:px-8"
            >
                <Link
                    href="/"
                    className={
                        "inline-flex h-11 items-center rounded-md text-lg font-bold " +
                        "tracking-tight text-stone-900 " +
                        focusClass
                    }
                >
                    {APP_NAME}
                </Link>

                <ul className="ml-4 flex items-center gap-1 sm:ml-8">
                    {NAV_LINKS.map((link) => (
                        <li key={link.href}>
                            <Link
                                href={link.href}
                                className={
                                    "inline-flex h-11 items-center rounded-md px-3 text-sm font-medium " +
                                    "text-stone-700 transition-colors hover:text-stone-900 " +
                                    "motion-reduce:transition-none " +
                                    focusClass
                                }
                            >
                                {link.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </header>
    );
}

export default function HomePage() {
    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-stone-50 text-stone-900 antialiased">
            <RibbonBackground />
            <Navbar />

            <main className="relative z-10 flex flex-1 items-start px-5 pb-56 pt-14 sm:px-8 sm:pt-20 lg:items-center lg:pb-24 lg:pt-12">
                <div className="mx-auto w-full max-w-6xl">
                    <div className="max-w-xl">
                        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                            <span className="text-stone-900">
                                Latih dan tes model Neural Network dari file CSV.
                            </span>{" "}
                            <span className="text-stone-600">
                                Atur parameter, mulai training, unduh model, lalu
                                coba prediksi dengan data baru.
                            </span>
                        </h1>

                        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/training"
                                className={
                                    "inline-flex h-11 items-center justify-center rounded-md bg-orange-700 px-6 " +
                                    "text-sm font-medium text-white transition-colors hover:bg-orange-800 " +
                                    "active:bg-orange-900 motion-reduce:transition-none " +
                                    focusClass
                                }
                            >
                                Mulai Training
                            </Link>

                            <Link
                                href="/test"
                                className={
                                    "inline-flex h-11 items-center justify-center rounded-md border border-stone-500 " +
                                    "bg-white px-6 text-sm font-medium text-stone-900 transition-colors " +
                                    "hover:bg-stone-100 motion-reduce:transition-none " +
                                    focusClass
                                }
                            >
                                Tes Model
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}