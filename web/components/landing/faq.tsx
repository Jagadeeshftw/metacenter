"use client";
import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { IconArrowRight } from "@/icons/arrow-right";

const FAQs = [
  {
    question: "What does coverage mean here?",
    answer:
      "The reward pool for a distribution interval divided by what bonds are owed for it (shares × target rate ÷ 10000 ÷ 50, as pox-5 computes it). Below 1.0× bonds are short-paid; STX-only stakers and the reserve get nothing.",
  },
  {
    question: "Can the reserve cover a shortfall?",
    answer:
      "Not today. pox-5 has no path from the reserve to bonds: transfer-from-reserve is private and never called, so it needs a SIP. The dashboard shows the reserve as hypothetical cover and says so next to the number.",
  },
  {
    question: "Who gets short-paid first?",
    answer:
      "Across bonds, pox-5 pays in descending stx-value-ratio, ties to the lower bond index, and later bonds absorb a shortfall first. Within a bond, every staked sat earns the same. The dashboard shows the current order; the stress test adds a hypothetical multi-bond book.",
  },
  {
    question: "What do onchain, mirrored and hypothetical mean?",
    answer:
      "onchain: computed by the pox5-reader contract on mainnet from pox-5 state. mirrored: posted by the publisher from mainnet events, the Hiro API or a price source, stored with raw inputs on the testnet risk-feed. hypothetical: stress tests and what-ifs, always with their assumptions.",
  },
  {
    question: "Why does the testnet feed show mainnet numbers?",
    answer:
      "Testnet has almost no bond stake, so its own numbers would say little. The testnet risk-feed mirrors mainnet distributions, posted with every raw input so anyone can recompute them. The mainnet pox5-reader computes the same figures from live pox-5 state.",
  },
  {
    question: "How fresh is the data?",
    answer:
      "The indexer polls every ~10 minutes. pox-5 distributes once per interval (1,050 Bitcoin blocks, about a week), so coverage for an interval is final once its calculate-rewards transaction is mined.",
  },
];
export function FrequentlyAskedQuestions() {
  const [open, setOpen] = React.useState<string | null>(null);

  return (
    <div id="faq" className="w-full max-w-7xl mx-auto my-10 md:my-20 py-10 md:py-20 px-4 md:px-8 scroll-mt-24">
      <div className="text-balance relative z-20 mx-auto mb-4 max-w-4xl text-center">
        <h2 className="text-metal inline-block text-3xl md:text-6xl">Questions</h2>
      </div>
      <p className="max-w-lg text-sm md:text-base text-center mx-auto mt-4 text-muted px-4 md:px-0">
        The short version. The methodology page has every formula and source.
      </p>
      <div className="mt-10 md:mt-20 max-w-3xl mx-auto divide-y divide-line">
        {FAQs.map((faq, index) => (
          <FAQItem
            key={index}
            question={faq.question}
            answer={faq.answer}
            open={open}
            setOpen={setOpen}
          />
        ))}
      </div>
    </div>
  );
}

const FAQItem = ({
  question,
  answer,
  setOpen,
  open,
}: {
  question: string;
  answer: string;
  open: string | null;
  setOpen: (open: string | null) => void;
}) => {
  const isOpen = open === question;

  return (
    <motion.button
      type="button"
      aria-expanded={isOpen}
      className="block w-full cursor-pointer py-4 md:py-6 text-left"
      onClick={() => {
        if (isOpen) {
          setOpen(null);
        } else {
          setOpen(question);
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="pr-8 md:pr-12">
          <h3 className="text-base md:text-lg font-medium text-foreground">
            {question}
          </h3>
          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden text-sm md:text-base text-muted mt-2"
              >
                <p>{answer}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="relative mr-2 md:mr-4 mt-1 h-5 w-5 md:h-6 md:w-6 flex-shrink-0">
          <motion.div
            animate={{
              scale: isOpen ? [0, 1] : [1, 0, 1],
              rotate: isOpen ? 90 : 0,
              marginLeft: isOpen ? "1.5rem" : "0rem",
            }}
            initial={{ scale: 0 }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            <IconArrowRight className="absolute inset-0 h-5 w-5 md:h-6 md:w-6 transform text-brand" />
          </motion.div>
        </div>
      </div>
    </motion.button>
  );
};
