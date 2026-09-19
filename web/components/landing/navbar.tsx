"use client";
import { cn } from "@/lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import Link from "next/link";
import React, { useRef, useState } from "react";
import { Button } from "./button";
import { Wordmark } from "@/components/shared/wordmark";
import { ThemeToggle } from "@/components/shared/theme";

interface NavbarProps {
  navItems: {
    name: string;
    link: string;
  }[];
  visible: boolean;
}

export const Navbar = () => {
  const navItems = [
    { name: "What it measures", link: "/#measures" },
    { name: "Use it", link: "/#use" },
    { name: "Methodology", link: "/methodology" },
    { name: "Docs", link: "/docs" },
    { name: "FAQ", link: "/#faq" },
  ];

  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const [visible, setVisible] = useState<boolean>(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 100) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  });

  return (
    <motion.div ref={ref} className="w-full fixed top-2 inset-x-0 z-50">
      <DesktopNav visible={visible} navItems={navItems} />
      <MobileNav visible={visible} navItems={navItems} />
    </motion.div>
  );
};

const DesktopNav = ({ navItems, visible }: NavbarProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <motion.div
      onMouseLeave={() => setHoveredIndex(null)}
      animate={{
        backdropFilter: "blur(16px)",
        width: visible ? "min(760px, 70%)" : "80%",
        height: visible ? "52px" : "64px",
        y: visible ? 8 : 0,
      }}
      initial={{
        width: "80%",
        height: "64px",
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      className={cn(
        "hidden xl:flex flex-row self-center items-center justify-between py-2 mx-auto px-6 rounded-full relative z-[60] backdrop-saturate-[1.8] border border-line/60",
        visible ? "bg-background/80" : "bg-background/40"
      )}
    >
      <Link href="/" aria-label="Metacenter home"><Wordmark className="text-sm" /></Link>
      <motion.div
        className="flex flex-row flex-1 items-center justify-center space-x-1 text-sm whitespace-nowrap"
        animate={{
          scale: visible ? 0.9 : 1,
          justifyContent: visible ? "flex-end" : "center",
        }}
      >
        {navItems.map((navItem, idx) => (
          <motion.div
            key={`nav-item-${idx}`}
            onHoverStart={() => setHoveredIndex(idx)}
            className="relative"
          >
            <Link
              className="text-foreground/85 relative px-3 py-1.5 transition-colors"
              href={navItem.link}
            >
              <span className="relative z-10">{navItem.name}</span>
              {hoveredIndex === idx && (
                <motion.div
                  layoutId="menu-hover"
                  className="absolute inset-0 rounded-full bg-brand-soft"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: 1,
                    scale: 1.1,
                      }}
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    transition: {
                      duration: 0.2,
                    },
                  }}
                  transition={{
                    type: "spring",
                    bounce: 0.4,
                    duration: 0.4,
                  }}
                />
              )}
            </Link>
          </motion.div>
        ))}
      </motion.div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button as={Link} href="/dashboard" variant="primary" className="rounded-full whitespace-nowrap">
          Open dashboard
        </Button>
      </div>
    </motion.div>
  );
};

const MobileNav = ({ navItems, visible }: NavbarProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.div
        animate={{
          backdropFilter: "blur(16px)",
          width: visible ? "92%" : "96%",
          y: visible ? 0 : 8,
          borderRadius: open ? "24px" : "full",
          padding: "8px 16px",
        }}
        initial={{
          width: "96%",
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
        className={cn(
          "flex relative flex-col xl:hidden w-full justify-between items-center max-w-[calc(100vw-2rem)] mx-auto z-50 backdrop-saturate-[1.8] border border-solid border-line rounded-full",
          visible ? "bg-background/85" : "bg-background/50"
        )}
      >
        <div className="flex flex-row justify-between items-center w-full">
          <Link href="/" aria-label="Metacenter home"><Wordmark className="text-sm" /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="inline-flex h-11 w-11 items-center justify-center text-foreground/90"
            >
              {open ? <IconX /> : <IconMenu2 />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{
                opacity: 0,
                y: -20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -20,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
              className="flex rounded-3xl absolute top-16 bg-background/95 border border-line backdrop-blur-xl backdrop-saturate-[1.8] inset-x-0 z-50 flex-col items-start justify-start gap-4 w-full px-6 py-8"
            >
              <Link href="/dashboard" onClick={() => setOpen(false)} className="text-brand font-medium py-2">
                Open dashboard
              </Link>
              {navItems.map(
                (navItem: { link: string; name: string }, idx: number) => (
                  <Link
                    key={`link=${idx}`}
                    href={navItem.link}
                    onClick={() => setOpen(false)}
                    className="relative text-foreground/90 hover:text-foreground transition-colors py-2"
                  >
                    <motion.span className="block">{navItem.name}</motion.span>
                  </Link>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};
