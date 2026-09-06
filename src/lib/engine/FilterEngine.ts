// ============================================================
// Offer Engine - FilterEngine
//
// Evaluates automation rules against a NormalizedOffer.
// Supports logical ALL/ANY modes and multiple operators.
// ============================================================

import type {
  FilterResult,
  NormalizedOffer,
  RuleOperator,
  RuleType,
  AutomationRuleSpec,
} from "@/lib/engine/types";

export interface FilterEngineConfig {
  rules: AutomationRuleSpec[];
  matchMode: "all" | "any";
}

const OPERATOR_ALIASES: Record<string, RuleOperator> = {
  "=": "equals",
  "==": "equals",
  "!=": "not_equals",
  ">": "greater_than",
  ">=": "greater_than_or_equal",
  "<": "less_than",
  "<=": "less_than_or_equal",
};

function normalizeOperator(op: string | undefined): RuleOperator {
  if (!op) return "equals";
  if (op in OPERATOR_ALIASES) {
    const aliased = OPERATOR_ALIASES[op];
    if (aliased) return aliased;
  }
  return op as RuleOperator;
}

function compareOperator(actual: number, expected: number, op: RuleOperator): boolean {
  switch (op) {
    case "greater_than":
      return actual > expected;
    case "greater_than_or_equal":
      return actual >= expected;
    case "less_than":
      return actual < expected;
    case "less_than_or_equal":
      return actual <= expected;
    case "not_equals":
      return actual !== expected;
    case "equals":
    default:
      return actual === expected;
  }
}

function stringCompare(actual: string, expected: string, op: RuleOperator): boolean {
  const a = actual.toLowerCase();
  const e = expected.toLowerCase();
  switch (op) {
    case "equals":
      return a === e;
    case "not_equals":
      return a !== e;
    case "contains":
      return a.includes(e);
    case "not_contains":
      return !a.includes(e);
    case "in":
      return a
        .split(",")
        .map((x) => x.trim())
        .includes(e);
    case "not_in":
      return !a
        .split(",")
        .map((x) => x.trim())
        .includes(e);
    default:
      return a === e;
  }
}

function listContains(haystack: string, needle: string): boolean {
  return haystack
    .toLowerCase()
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .some((x) => needle.toLowerCase().includes(x) || x.includes(needle.toLowerCase()));
}

export class FilterEngine {
  readonly config: FilterEngineConfig;

  constructor(config: FilterEngineConfig) {
    this.config = config;
  }

  evaluate(offer: NormalizedOffer): FilterResult {
    const evaluated = this.config.rules.map((rule) => ({
      rule,
      result: this.evaluateRule(offer, rule),
    }));

    const passed =
      this.config.rules.length === 0
        ? true
        : this.config.matchMode === "any"
          ? evaluated.some((e) => e.result)
          : evaluated.every((e) => e.result);

    // The rule that blocked (first failing) for the report
    const blockedBy = passed
      ? null
      : this.config.matchMode === "all"
        ? evaluated.find((e) => !e.result)?.rule.rule_type || null
        : evaluated.length === 0
          ? null
          : evaluated.every((e) => !e.result)
            ? (evaluated[0]?.rule.rule_type ?? null)
            : null;

    return { passed, blockedBy, evaluated };
  }

  private evaluateRule(offer: NormalizedOffer, rule: AutomationRuleSpec): boolean {
    const { rule_type, rule_value } = rule;
    const op = normalizeOperator(rule.operator);

    switch (rule_type) {
      case "min_price":
        return compareOperator(
          offer.price,
          number(rule_value),
          op === "equals" ? "greater_than_or_equal" : op,
        );
      case "max_price":
        return compareOperator(
          offer.price,
          number(rule_value),
          op === "equals" ? "less_than_or_equal" : op,
        );
      case "min_discount": {
        const d = offer.discountPercentage ?? 0;
        return compareOperator(
          d,
          number(rule_value),
          op === "equals" ? "greater_than_or_equal" : op,
        );
      }
      case "max_discount": {
        const d = offer.discountPercentage ?? 0;
        return compareOperator(d, number(rule_value), op === "equals" ? "less_than_or_equal" : op);
      }
      case "marketplace":
        return stringCompare(offer.marketplaceName, rule_value, op);
      case "category":
        return offer.metadata?.["category"]
          ? stringCompare(String(offer.metadata["category"]), rule_value, op)
          : false;
      case "forbidden_words":
        return !listContains(rule_value, offer.title + " " + (offer.description || ""));
      case "forbidden_domains":
        return !listContains(
          rule_value,
          (offer.originalUrl || "") +
            " " +
            (offer.canonicalUrl || "") +
            " " +
            (offer.affiliateUrl || "") +
            " " +
            offer.title,
        );
      case "required_words":
      case "contains_words":
        return listContains(rule_value, offer.title + " " + (offer.description || ""));
      case "coupon_only":
        return op === "not_equals" ? !offer.coupon : Boolean(offer.coupon);
      case "no_coupon_only":
        return op === "not_equals" ? Boolean(offer.coupon) : !offer.coupon;
      case "min_rating":
        return true; // rating not currently captured
      default:
        return true;
    }
  }
}

function number(value: string): number {
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export function buildFilterEngine(
  rules: AutomationRuleSpec[],
  matchMode: "all" | "any",
): FilterEngine {
  return new FilterEngine({ rules, matchMode });
}
