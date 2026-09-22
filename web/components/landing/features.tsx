"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  IconBuildingBank,
  IconChartLine,
  IconClock,
  IconCoins,
  IconCurrencyBitcoin,
  IconScale,
  IconShieldCheck,
} from "@tabler/icons-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Mark } from "@/components/shared/wordmark";
import { ProvenanceGlyph } from "@/components/shared/provenance";
import type { Provenance } from "@/lib/api";
import blocks from "@/data/interval-286-blocks.json";

export function Features({ testCount }: { testCount: { simnet: number; fork: number } }) {
  const total = testCount.simnet + testCount.fork;
  return (
    <div id="measures" className="w-full max-w-7xl mx-auto py-4 px-4 md:px-8 md:my-20 md:py-20 scroll-mt-24">
      <div className="text-balance relative z-20 mx-auto mb-4 max-w-4xl text-center text-lg font-semibold tracking-tight md:text-3xl">
        <h2 className="text-metal inline-block text-3xl md:text-6xl">What it measures</h2>
      </div>
      <p className="max-w-xl text-sm md:text-base text-center mx-auto mt-4 text-muted">
        Bond coverage, the reserve, STX-only yield and stress tests, defined exactly as pox-5 pays out: bonds first in
        stx-value-ratio order, then 15% of the rest to the reserve, then STX-only stakers.
      </p>
      <div className="mt-20 grid cols-1 lg:grid-cols-5 gap-4 auto-rows-[25rem] max-w-3xl mx-auto lg:max-w-none">
        <Card className="flex flex-col relative justify-between lg:col-span-2">
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/3">
            <LogoOrbit />
          </div>
          <CardContent className="h-44 absolute bottom-0">
            <CardTitle>
              Read straight
              <br /> from pox-5
            </CardTitle>
            <CardDescription>
              pox5-reader is a read-only Clarity contract on mainnet. It computes obligation, coverage and payout order
              from pox-5 state, with no publisher in the loop.
            </CardDescription>
          </CardContent>
        </Card>
        <Card className="flex relative flex-col justify-between lg:col-span-3">
          <CardContent className="h-44 relative z-10">
            <CardTitle>
              Every block,
              <br /> accounted for
            </CardTitle>
            <CardDescription>
              In distribution 286, {blocks.paying.toLocaleString("en-US")} of {blocks.total.toLocaleString("en-US")} Bitcoin
              blocks carried miner commits to the sBTC address ({(blocks.sats / 1e6).toFixed(2)}M sats). The other{" "}
              {blocks.total - blocks.paying} had no sortition: nothing paid, nothing burned.
            </CardDescription>
          </CardContent>
          <div className="absolute inset-x-0 bottom-0 top-44">
            <BlockGrid />
          </div>
          <p className="text-metal num absolute right-0 top-0 p-6 text-right text-2xl md:text-5xl leading-tight">
            {blocks.paying}/{blocks.total.toLocaleString("en-US")}
            <br />
            <span className="text-base md:text-xl">blocks paid</span>
          </p>
        </Card>
        <Card className="flex flex-col relative justify-between lg:col-span-3">
          <p className="text-metal num absolute right-0 top-0 p-6 text-right text-2xl md:text-5xl leading-tight">
            {total}
            <br />
            <span className="text-base md:text-xl">contract tests</span>
          </p>
          <CardSkeletonBody>
            <div className="relative flex h-[300px] w-full flex-col items-start top-24 md:top-14 overflow-hidden rounded-lg">
              <IconsList />
            </div>
          </CardSkeletonBody>
          <CardContent className="h-44 relative mb-4">
            <CardTitle>
              Tested against <br /> mainnet state
            </CardTitle>
            <CardDescription>
              {testCount.simnet} simnet tests cover every error code. {testCount.fork} more run pox5-reader against a fork
              of mainnet and match the live distribution within 2 sats.
            </CardDescription>
          </CardContent>
          <div className="absolute right-4 bottom-4 opacity-10 md:opacity-100">
            <ProvenanceGrid />
          </div>
        </Card>
        <Card className="flex flex-col justify-between lg:col-span-2">
          <CardContent className="h-44">
            <CardTitle>
              The rules, as <br /> the contract has them
            </CardTitle>
            <CardDescription>Read from the deployed pox-5 source, line by line.</CardDescription>
          </CardContent>
          <CardSkeletonBody>
            <div className="w-full h-full p-4 rounded-lg px-6 md:px-10 mt-6">
              <CardStack items={CARDS} />
            </div>
          </CardSkeletonBody>
        </Card>
      </div>
    </div>
  );
}

const CardSkeletonBody = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("overflow-hidden relative w-full h-full", className)}>{children}</div>
);

const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("p-6", className)}>{children}</div>
);

const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h3 className={cn("text-metal inline-block text-xl md:text-4xl", className)}>{children}</h3>
);

const CardDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("max-w-sm text-sm font-normal tracking-tight mt-2 text-muted", className)}>{children}</p>
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    whileHover="animate"
    className={cn(
      "group relative isolate flex flex-col rounded-2xl border border-line overflow-hidden",
      "[background:linear-gradient(180deg,var(--card-top),var(--card-bottom))] shadow-[0_24px_68px_var(--shadow)]",
      className,
    )}
  >
    <GlowingEffect spread={60} glow={true} disabled={false} proximity={64} inactiveZone={0.01} borderWidth={3} blur={10} />
    {children}
  </motion.div>
);

const IconsList = () => {
  const commonStyles = useMemo(
    () =>
      "rounded-[13px] w-[50px] h-[50px] md:w-[70px] md:h-[70px] flex-[1_0_0] border border-line flex items-center justify-center text-foreground transition-colors",
    []
  );

  const icons = useMemo(
    () => [
      { Icon: IconCurrencyBitcoin, delay: 0 },
      { Icon: IconScale, delay: 0.1 },
      { Icon: IconBuildingBank, delay: 0.2 },
      { Icon: IconChartLine, delay: 0.3 },
      { Icon: IconShieldCheck, delay: 0.4 },
    ],
    []
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (!isHovered) {
      interval = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % icons.length);
      }, 2000);
    }

    return () => clearInterval(interval);
  }, [icons.length, isHovered]);

  const IconComponents = useMemo(
    () =>
      icons.map(({ Icon, delay }, index) => (
        <motion.div
          key={index}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            backgroundColor: index === activeIndex ? "var(--brand-soft)" : "var(--surface-2)",
            boxShadow:
              index === activeIndex ? "0px 8px 18px 0px var(--shadow)" : "0px 0px 0px 0px var(--shadow)",
          }}
          onMouseEnter={() => {
            setIsHovered(true);
            setActiveIndex(index);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
          }}
          transition={{
            delay,
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1],
            backgroundColor: {
              duration: 0.3,
              ease: "easeInOut",
            },
            boxShadow: {
              duration: 0.3,
              ease: "easeInOut",
            },
          }}
          className={commonStyles}
        >
          <Icon className="w-6 h-6 md:w-9 md:h-9" stroke={1.5} />
        </motion.div>
      )),
    [icons, activeIndex, commonStyles]
  );

  return (
    <div className="inline-flex items-center gap-[6px] md:gap-[11px] p-[6px] md:p-[9px] rounded-[0px_20px_20px_0px] border border-line [background:linear-gradient(88deg,var(--surface)_0.35%,var(--surface-3)_98.6%)] shadow-[0px_18px_18px_0px_var(--shadow)]">
      {IconComponents}
    </div>
  );
};


let interval: NodeJS.Timeout;
type Card = {
  id: number;
  name: string;
  designation?: string;
  content: React.ReactNode;
};
export const CardStack = ({
  items,
  offset,
  scaleFactor,
}: {
  items: Card[];
  offset?: number;
  scaleFactor?: number;
}) => {
  const CARD_OFFSET = offset || 10;
  const SCALE_FACTOR = scaleFactor || 0.06;
  const [cards, setCards] = useState<Card[]>(items);

  useEffect(() => {
    startFlipping();
    return () => clearInterval(interval);
  }, []);

  const startFlipping = () => {
    interval = setInterval(() => {
      setCards((prevCards: Card[]) => {
        const newArray = [...prevCards];
        newArray.unshift(newArray.pop()!);
        return newArray;
      });
    }, 5000);
  };

  return (
    <div className="relative h-48 md:h-36 w-full mx-auto">
      {cards.map((card, index) => {
        return (
          <motion.div
            key={card.id}
            className="absolute w-full h-full p-4 flex flex-col justify-between rounded-[16px] [background:linear-gradient(180deg,var(--card-top)_0%,var(--card-bottom)_100%)] shadow-[0px_1px_1px_0px_var(--inset-hi)_inset] border border-line"
            style={{
              transformOrigin: "top center",
            }}
            animate={{
              top: index * -CARD_OFFSET,
              scale: 1 - index * SCALE_FACTOR,
              zIndex: cards.length - index,
            }}
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
              <Mark className="h-6 w-6 text-foreground" />
              <div className="flex flex-col sm:flex-row sm:gap-2">
                <p className="text-sm sm:text-base  font-medium text-foreground num">
                  {card.name}
                </p>
                {card.designation && (
                  <p className="text-sm sm:text-base font-normal text-muted">
                    {card.designation}
                  </p>
                )}
              </div>
            </div>
            <div className="font-normal text-xs sm:text-sm text-foreground/90 mt-2">
              {card.content}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};


export const Highlight = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("font-semibold bg-brand-soft text-brand px-1 py-0.5 rounded-sm", className)}>{children}</span>
);

const CARDS = [
  {
    id: 0,
    name: "pox-5 L2285–2299",
    content: (
      <p>
        Bonds are paid in <Highlight>descending stx-value-ratio</Highlight>; ties go to the lower bond index. Within a
        bond, every sat earns the same.
      </p>
    ),
  },
  {
    id: 1,
    name: "pox-5 L2190",
    content: (
      <p>
        The reserve takes <Highlight>15% of what remains</Highlight> after bonds. STX-only stakers get the other 85%.
      </p>
    ),
  },
  {
    id: 2,
    name: "pox-5 L2696",
    content: (
      <p>
        <Highlight>transfer-from-reserve</Highlight> is private and uncalled in this iteration. Using the reserve goes through a SIP process without a
        SIP; in a shortfall it stays flat.
      </p>
    ),
  },
];

const TILES: Provenance[] = ["onchain", "mirrored", "hypothetical", "onchain", "mirrored", "hypothetical"];

const ProvenanceGrid = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (!isHovered) {
      interval = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % TILES.length);
      }, 2000);
    }

    return () => clearInterval(interval);
  }, [isHovered]);

  useEffect(() => {
    if (hoveredIndex !== null) {
      setActiveIndex(hoveredIndex);
    }
  }, [hoveredIndex]);

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 gap-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredIndex(null);
      }}
    >
      {TILES.map((tile, index) => (
        <motion.div
          key={index}
          className="relative"
          initial={{ y: 20, opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
            scale: index === activeIndex ? [1, 1.2, 1] : 0.9,
            rotate: index === activeIndex ? [0, -10, 10, 0] : 0,
          }}
          transition={{
            duration: 0.6,
            scale: {
              duration: 0.8,
              times: [0, 0.5, 1],
              ease: "easeInOut",
              repeat: index === activeIndex ? Infinity : 0,
              repeatDelay: 1,
            },
            rotate: {
              duration: 0.8,
              times: [0, 0.25, 0.75, 1],
              ease: "easeInOut",
              repeat: index === activeIndex ? Infinity : 0,
              repeatDelay: 1,
            },
          }}
          whileHover={{
            scale: 1.1,
            transition: { duration: 0.2 },
          }}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <div
            className="flex h-[58px] w-[58px] md:h-[70px] md:w-[70px] items-center justify-center rounded-lg border border-line bg-surface-2"
            style={{ opacity: index === activeIndex ? 1 : 0.75, transition: "opacity 0.3s ease" }}
          >
            <ProvenanceGlyph kind={tile} size={22} />
          </div>
        </motion.div>
      ))}
    </div>
  );
};


const OrbitingIcons = ({
  centerIcon,
  orbits,
  className,
}: {
  centerIcon?: React.ReactNode;
  orbits: Array<{
    icons: React.ReactNode[];
    radius?: number;
    speed?: number;
    rotationDirection?: "clockwise" | "anticlockwise";
    revealTime?: number;
    delay?: number;
  }>;
  className?: string;
}) => {
  // Precalculate all orbit data
  const orbitData = React.useMemo(() => {
    return orbits.map((orbit, orbitIndex) => {
      const radius = orbit.radius || 100 + orbitIndex * 80;
      const speed = orbit.speed || 1;
      const revealTime = orbit.revealTime || 0.5;
      const orbitDelay = orbit.delay || 0;
      const iconCount = orbit.icons.length;

      // Calculate angles for each icon
      const angleStep = 360 / iconCount;
      const angles = Array.from({ length: iconCount }, (_, i) => angleStep * i);

      // Precalculate positions and animations for each icon
      const iconData = angles.map((angle) => {
        const randomDelay = -Math.random() * speed;
        const rotationAngle =
          orbit.rotationDirection === "clockwise"
            ? [angle, angle - 360]
            : [angle, angle + 360];

        return {
          angle,
          randomDelay,
          rotationAngle,
          position: {
            x: radius * Math.cos((angle * Math.PI) / 180),
            y: radius * Math.sin((angle * Math.PI) / 180),
          },
          animation: {
            initial: {
              rotate: angle,
              scale: 0,
              opacity: 0,
            },
            animate: {
              rotate: rotationAngle,
              scale: 1,
              opacity: 1,
            },
            transition: {
              rotate: {
                duration: speed,
                repeat: Infinity,
                ease: [0, 0, 1, 1] as const,
                delay: randomDelay + orbitDelay,
              },
              scale: {
                duration: revealTime,
                delay: Math.abs(randomDelay) + orbitDelay,
              },
              opacity: {
                duration: revealTime,
                delay: Math.abs(randomDelay) + orbitDelay,
              },
            },
            counterRotation: {
              initial: { rotate: -angle },
              animate: {
                rotate:
                  orbit.rotationDirection === "clockwise"
                    ? [-angle, -angle + 360]
                    : [-angle, -angle - 360],
              },
              transition: {
                duration: speed,
                repeat: Infinity,
                ease: [0, 0, 1, 1] as const,
                delay: randomDelay + orbitDelay,
              },
            },
          },
        };
      });

      return {
        radius,
        speed,
        revealTime,
        orbitDelay,
        iconData,
        rotationDirection: orbit.rotationDirection,
      };
    });
  }, [orbits]);

  return (
    <div className={cn("relative w-[300px] h-[300px]", className)}>
      {centerIcon && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          {centerIcon}
        </div>
      )}
      {orbitData.map((orbit, orbitIndex) => (
        <div
          key={orbitIndex}
          className="absolute top-0 left-0 w-full h-full"
          style={{ zIndex: orbits.length - orbitIndex }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[343.721px] border border-line [background:linear-gradient(189deg,var(--surface-2)_5.97%,var(--surface)_92.92%)] shadow-[0px_18px_18px_0px_var(--shadow),inset_0px_0px_20px_var(--shadow)]"
            style={{
              width: orbit.radius * 2 + "px",
              height: orbit.radius * 2 + "px",
            }}
          />

          {orbit.iconData.map((icon, iconIndex) => (
            <motion.div
              key={iconIndex}
              className="absolute"
              style={{
                width: "40px",
                height: "40px",
                left: `calc(50% - 20px)`,
                top: `calc(50% - 20px)`,
                transformOrigin: "center center",
              }}
              initial={icon.animation.initial}
              animate={icon.animation.animate}
              transition={icon.animation.transition}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${orbit.radius}px`,
                  transformOrigin: "center center",
                }}
              >
                <motion.div
                  initial={icon.animation.counterRotation.initial}
                  animate={icon.animation.counterRotation.animate}
                  transition={icon.animation.counterRotation.transition}
                  className="w-10 h-10 rounded-md bg-surface-2 border border-line flex items-center justify-center text-foreground shadow-[0px_4px_4px_0px_var(--shadow)]"
                >
                  {orbits[orbitIndex].icons[iconIndex]}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
};


const LogoOrbit = () => {
  const cls = "w-7 h-7";
  const orbit1Icons = [
    <IconCurrencyBitcoin key="btc" className={cls} stroke={1.5} />,
    <IconScale key="scale" className={cls} stroke={1.5} />,
    <IconBuildingBank key="bank" className={cls} stroke={1.5} />,
  ];
  const orbit2Icons = [
    <IconChartLine key="chart" className="w-5 h-5" stroke={1.5} />,
    <IconShieldCheck key="shield" className="w-5 h-5" stroke={1.5} />,
    <IconCoins key="coins" className="w-5 h-5" stroke={1.5} />,
    <IconClock key="clock" className="w-5 h-5" stroke={1.5} />,
  ];
  return (
    <OrbitingIcons
      centerIcon={<Mark className="h-10 w-10 text-foreground" />}
      orbits={[
        { icons: orbit1Icons, rotationDirection: "clockwise", radius: 80, speed: 7 },
        { icons: orbit2Icons, rotationDirection: "anticlockwise", radius: 140, speed: 10 },
      ]}
    />
  );
};

// Cryptgen's flashing map, repurposed: one dot per Bitcoin block of distribution 286.
// Filled dots paid the pool; flashing points pulse on a few of them.
const BlockGrid = () => {
  const cols = 50;
  const mask = blocks.mask;
  const rows = Math.ceil(mask.length / cols);
  const flashing = useMemo(() => {
    const paid: number[] = [];
    for (let i = 0; i < mask.length; i++) if (mask[i] === "1") paid.push(i);
    return Array.from({ length: 10 }, (_, k) => {
      const i = paid[Math.floor((k + 0.5) * (paid.length / 10))];
      return { x: i % cols, y: Math.floor(i / cols), delay: (k / 10) * 3, duration: 2 + (k % 3) * 0.4 };
    });
  }, [mask]);
  return (
    <div className="relative h-full w-full px-6 pb-6">
      <svg viewBox={`0 0 ${cols * 10} ${rows * 10}`} className="h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_20%)]" role="img" aria-label={`${blocks.paying} of ${blocks.total} blocks in distribution 286 paid the pool`}>
        {Array.from(mask).map((m, i) => (
          <circle key={i} cx={(i % cols) * 10 + 5} cy={Math.floor(i / cols) * 10 + 5} r={m === "1" ? 3 : 2.2} fill={m === "1" ? "var(--series-pool)" : "var(--hatch)"} opacity={m === "1" ? 0.85 : 0.6} />
        ))}
        {flashing.map((p, i) => (
          <motion.circle
            key={`f${i}`}
            cx={p.x * 10 + 5}
            cy={p.y * 10 + 5}
            r={5}
            fill="var(--series-pool)"
            animate={{ opacity: [0, 0.8, 0], scale: [1, 1.6, 1] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </svg>
      <div className="absolute bottom-3 left-6 flex gap-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pool" />paid</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--hatch)" }} />no sortition</span>
      </div>
    </div>
  );
};
