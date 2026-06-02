import { describe, expect, it } from "vitest";

import {
  DEFAULT_CODE_DOMAIN_PROFILE,
  validateDomainProfile,
} from "../../src/shared/lib/safety/domain-profile";

import type {
  DomainProfile,
  DomainProfileName,
} from "../../src/shared/lib/safety/domain-profile";

const baseProfile = (name: DomainProfileName = "code"): DomainProfile => ({
  name,
  artifactTypes: ["patch"],
  verifier: {
    hardChecks: ["typecheck"],
    softChecks: ["lint"],
    passCriteria: "must pass typecheck",
  },
  rollback: "git apply -R",
  costSignals: ["tokens"],
});

describe("DEFAULT_CODE_DOMAIN_PROFILE", () => {
  it("name is 'code'", () => {
    expect(DEFAULT_CODE_DOMAIN_PROFILE.name).toBe("code");
  });

  it("hardChecks contain typecheck, unit_tests, targeted_tests", () => {
    expect(DEFAULT_CODE_DOMAIN_PROFILE.verifier.hardChecks).toContain("typecheck");
    expect(DEFAULT_CODE_DOMAIN_PROFILE.verifier.hardChecks).toContain("unit_tests");
    expect(DEFAULT_CODE_DOMAIN_PROFILE.verifier.hardChecks).toContain("targeted_tests");
  });

  it("softChecks contain lint and code_review", () => {
    expect(DEFAULT_CODE_DOMAIN_PROFILE.verifier.softChecks).toContain("lint");
    expect(DEFAULT_CODE_DOMAIN_PROFILE.verifier.softChecks).toContain("code_review");
  });

  it("passCriteria is non-empty and mentions typecheck", () => {
    expect(DEFAULT_CODE_DOMAIN_PROFILE.verifier.passCriteria.length).toBeGreaterThan(0);
    expect(DEFAULT_CODE_DOMAIN_PROFILE.verifier.passCriteria).toContain("typecheck");
  });

  it("rollback policy explicitly forbids git reset --hard", () => {
    expect(DEFAULT_CODE_DOMAIN_PROFILE.rollback).toContain("git reset --hard");
  });

  it("costSignals include tokens, test_runtime, changed_files", () => {
    expect(DEFAULT_CODE_DOMAIN_PROFILE.costSignals).toContain("tokens");
    expect(DEFAULT_CODE_DOMAIN_PROFILE.costSignals).toContain("test_runtime");
    expect(DEFAULT_CODE_DOMAIN_PROFILE.costSignals).toContain("changed_files");
  });
});

describe("validateDomainProfile", () => {
  it("accepts the default code profile", () => {
    const r = validateDomainProfile(DEFAULT_CODE_DOMAIN_PROFILE);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("accepts a minimal valid profile", () => {
    const r = validateDomainProfile(baseProfile());
    expect(r.valid).toBe(true);
  });

  it("rejects missing hardChecks", () => {
    const p: DomainProfile = {
      ...baseProfile(),
      verifier: {
        hardChecks: [],
        softChecks: ["lint"],
        passCriteria: "x",
      },
    };
    const r = validateDomainProfile(p);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "hardChecks")).toBe(true);
  });

  it("rejects empty passCriteria", () => {
    const p: DomainProfile = {
      ...baseProfile(),
      verifier: {
        hardChecks: ["typecheck"],
        softChecks: [],
        passCriteria: "   ",
      },
    };
    const r = validateDomainProfile(p);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "passCriteria")).toBe(true);
  });

  it("rejects empty rollback", () => {
    const p: DomainProfile = { ...baseProfile(), rollback: "" };
    const r = validateDomainProfile(p);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "rollback")).toBe(true);
  });

  it("rejects empty costSignals", () => {
    const p: DomainProfile = { ...baseProfile(), costSignals: [] };
    const r = validateDomainProfile(p);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "costSignals")).toBe(true);
  });

  it("rejects empty artifactTypes", () => {
    const p: DomainProfile = { ...baseProfile(), artifactTypes: [] };
    const r = validateDomainProfile(p);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === "artifactTypes")).toBe(true);
  });
});
