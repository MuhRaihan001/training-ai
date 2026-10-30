import React from "react";
import Link from "next/link";

const GITHUB_URL = "https://github.com/MuhRaihan001";

const FEATURES = [
    {
        name: "Dataset management",
        text: "Upload CSV datasets and decide how each column is treated before training.",
    },
    {
        name: "Model configuration",
        text: "Set epochs, optimizer, learning rate, and loss function.",
    },
    {
        name: "Training analysis",
        text: "Follow training through charts, metrics, and insights.",
    },
    {
        name: "Model testing",
        text: "Load a trained model, enter new data, and see how the network reaches its decision.",
    },
];

const STEPS = [
    {
        title: "Upload a dataset",
        text: "Add a CSV file as the training data.",
    },
    {
        title: "Configure the model",
        text: "Set the network and training parameters.",
    },
    {
        title: "Train the model",
        text: "Run training and read the evaluation results.",
    },
    {
        title: "Test and explore",
        text: "Load the model, enter new data, and follow how the prediction is made.",
    },
];

const TECHNOLOGY = [
    {
        name: "TensorFlow.js",
        role: "Machine learning framework",
        href: "https://www.tensorflow.org/js",
    },
    {
        name: "Next.js",
        role: "Application framework",
        href: "https://nextjs.org",
    },
    {
        name: "Tailwind CSS",
        role: "Application styling",
        href: "https://tailwindcss.com/"
    },
    {
        name: "React",
        role: "User interface library",
        href: "https://react.dev",
    },
];

const focusClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50";

const textLinkClass =
    "inline-flex h-11 items-center rounded-md font-medium text-stone-900 underline " +
    "decoration-stone-400 underline-offset-4 transition-colors hover:decoration-orange-700 " +
    "motion-reduce:transition-none " +
    focusClass;


function Section({ id, title, children }) {
    const headingId = `about-${id}`;

    return (
        <section
            aria-labelledby={headingId}
            className="border-t border-stone-200 py-14 sm:py-20"
        >
            <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
                <h2
                    id={headingId}
                    className="text-lg font-semibold tracking-tight text-stone-900 lg:col-span-3"
                >
                    {title}
                </h2>
                <div className="lg:col-span-9">{children}</div>
            </div>
        </section>
    );
}

function ProjectSection() {
    return (
        <Section id="project" title="About the project">
            <p className="max-w-3xl text-2xl font-semibold leading-snug tracking-tight text-stone-900 sm:text-3xl lg:text-4xl">
                An interactive learning environment for understanding neural networks
                through hands-on experimentation.
            </p>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-stone-700">
                Neural Network Playground is a place to build, train, and test a neural
                network without writing code. Upload a dataset, choose the settings, and
                watch the model learn. Once training is done, load the model, enter new
                values, and see how the network arrives at a prediction.
            </p>
        </Section>
    );
}

function PurposeSection() {
    return (
        <Section id="purpose" title="Our purpose">
            <p className="max-w-2xl text-xl font-semibold leading-snug tracking-tight text-stone-900 sm:text-2xl">
                Understanding machine learning takes more than reading the theory.
            </p>
            <div className="mt-8 grid max-w-3xl gap-6 text-base leading-relaxed text-stone-700 md:grid-cols-2 md:gap-10">
                <p>
                    Experimenting with a dataset shows how a model is trained, how each
                    setting changes its performance, and how a prediction is produced.
                </p>
                <p>
                    The playground removes the need to write code, so beginners can spend
                    their time on how the model behaves. It is built for students and for
                    anyone new to neural networks.
                </p>
            </div>
        </Section>
    );
}

function StepsSection() {
    return (
        <Section id="steps" title="How it works">
            <ol role="list" className="max-w-xl border-l border-stone-300">
                {STEPS.map((step, index) => (
                    <li key={step.title} className="relative pb-10 pl-8 last:pb-0">
                        <span
                            aria-hidden="true"
                            className="absolute -left-[5.5px] top-2 h-2.5 w-2.5 rounded-full border border-stone-500 bg-stone-50"
                        />
                        <p
                            aria-hidden="true"
                            className="text-sm font-medium tabular-nums text-orange-700"
                        >
                            Step {index + 1}
                        </p>
                        <h3 className="mt-1 font-semibold text-stone-900">{step.title}</h3>
                        <p className="mt-1 leading-relaxed text-stone-700">{step.text}</p>
                    </li>
                ))}
            </ol>

            <div className="mt-12 flex flex-col gap-3 sm:flex-row">
                <Link
                    href="/training"
                    className={
                        "inline-flex h-11 items-center justify-center rounded-md bg-orange-700 px-6 " +
                        "text-sm font-medium text-white transition-colors hover:bg-orange-800 " +
                        "active:bg-orange-900 motion-reduce:transition-none " +
                        focusClass
                    }
                >
                    Start Training
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
                    Run Model
                </Link>
            </div>
        </Section>
    );
}

function TechnologySection() {
    return (
        <Section id="technology" title="Built with">
            <ul
                role="list"
                className="max-w-xl divide-y divide-stone-200 border-y border-stone-200"
            >
                {TECHNOLOGY.map((item) => (
                    <li
                        key={item.name}
                        className="flex flex-wrap items-center justify-between gap-x-6"
                    >
                        <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={textLinkClass}
                        >
                            {item.name}
                            <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                        <span className="text-sm text-stone-600">{item.role}</span>
                    </li>
                ))}
            </ul>
        </Section>
    );
}

function DeveloperSection() {
    return (
        <Section id="developer" title="Developer">
            <p className="max-w-2xl text-lg leading-relaxed text-stone-700">
                Neural Network Playground is an independent project developed by Han,
                with the goal of making machine learning experimentation more accessible
                to students and beginners.
            </p>
            <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={"mt-4 " + textLinkClass}
            >
                GitHub: MuhRaihan001
                <span className="sr-only"> (opens in a new tab)</span>
            </a>
        </Section>
    );
}

export function AboutPage() {
    return (
        <div id="about" className="bg-stone-50 text-stone-900 antialiased">
            <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
                <ProjectSection />
                <PurposeSection />
                <StepsSection />
                <TechnologySection />
                <DeveloperSection />
            </div>
        </div>
    );
}

export default AboutPage;