/**
 * Stage 3a: Self-assessment questionnaire generation.
 *
 * For each attack chain step, one SelfAssessmentEntry is generated per
 * breaking control. Analyst-asserted controls carry mapping_basis:
 * "analyst-asserted" and have their testability drawn from the human-identity
 * library (Invariant 4). CTID-mapped controls default to "self-reported-only"
 * (conservative, Invariant 6).
 *
 * vulnerable_looks_like and resilient_looks_like are always phrased generically
 * — they never name or accuse the victim organisation (Invariant 10).
 */
import { HUMAN_IDENTITY_CONTROLS } from "@registry";
import type { AttackChainStep, SelfAssessmentEntry, Testability } from "./schema.js";

/** Axis-specific question, resilient, and vulnerable descriptions per technique. */
interface AxisDescription {
  question: string;
  resilient_looks_like: string;
  vulnerable_looks_like: string;
}

const DESCRIPTIONS: Record<string, Record<string, AxisDescription>> = {
  "T1566.004": {
    prevent: {
      question:
        "Does your organisation require a verified call-back to a number drawn from authoritative identity records before any credential or MFA reset via the IT service desk?",
      resilient_looks_like:
        "All credential and MFA reset requests require call-back verification against authoritative identity records; resets on the basis of caller-supplied information alone are rejected by policy and enforced in the service-desk tooling.",
      vulnerable_looks_like:
        "Credential or MFA resets can be completed over the phone on the basis of caller-supplied identity alone, without secondary verification; an attacker posing as a legitimate user can obtain a reset.",
    },
    detect: {
      question:
        "Does your organisation alert in near-real-time on anomalous MFA enrolment or credential-reset events originating from IT service-desk channels (e.g., bulk, out-of-hours, or high-velocity resets)?",
      resilient_looks_like:
        "The SOC receives real-time alerts for bulk, out-of-hours, or anomalous MFA enrolment and credential-reset events; a documented runbook exists for suspected service-desk-sourced credential fraud.",
      vulnerable_looks_like:
        "Anomalous or out-of-hours MFA enrolment and credential-reset events are not specifically alerted on; a fraudulent service-desk reset can proceed without immediate detection.",
    },
    respond: {
      question:
        "Does your organisation have a documented playbook to immediately revoke sessions and suspend accounts following a suspected fraudulent service-desk credential reset?",
      resilient_looks_like:
        "An incident response playbook exists for suspected fraudulent credential resets; compromised accounts are suspended and all sessions revoked within a defined SLA, requiring re-verified identity enrolment before reinstatement.",
      vulnerable_looks_like:
        "There is no specific response playbook for service-desk credential fraud; a foothold obtained via a fraudulent reset may persist undetected until broader investigation.",
    },
  },
  "T1656": {
    prevent: {
      question:
        "Does your organisation require verification against authoritative HR or identity records for any urgently-framed or executive-impersonation credential request?",
      resilient_looks_like:
        "Identity verification against authoritative records is required before any credential action regardless of urgency framing; social-engineering pressure cannot bypass the verification process.",
      vulnerable_looks_like:
        "Urgently-framed or executive-impersonation credential requests can succeed without secondary identity verification; an attacker impersonating a senior user can obtain a credential reset.",
    },
    detect: {
      question:
        "Does your organisation monitor service-desk interaction patterns for impersonation indicators (e.g., multiple resets for the same account, resets shortly after inbound social calls)?",
      resilient_looks_like:
        "Service-desk logs are analysed for impersonation-indicator patterns; repeated resets for the same account or resets following social calls are flagged for SOC review.",
      vulnerable_looks_like:
        "No monitoring exists for impersonation-indicator patterns at the service desk; an attacker can conduct incremental social-engineering without detection.",
    },
    respond: {
      question:
        "Does your organisation revoke all sessions and escalate to incident response when an account receives an unverified reset followed by suspicious lateral movement?",
      resilient_looks_like:
        "A suspicious reset followed by anomalous activity triggers automatic session revocation and an IR escalation workflow; lateral movement is contained before propagation.",
      vulnerable_looks_like:
        "An unverified reset followed by lateral movement may not be escalated in time to prevent propagation; the response is reactive rather than proactive.",
    },
  },
  "T1003.003": {
    prevent: {
      question:
        "Does your organisation restrict access to NTDS.dit and Active Directory credential databases beyond standard domain-administrator roles, with access logging and review?",
      resilient_looks_like:
        "Access to NTDS.dit and equivalent credential stores is restricted to a minimal set of tightly-controlled roles; all access is logged, reviewed, and requires privileged-access workstation controls.",
      vulnerable_looks_like:
        "Compromised domain-administrator credentials can directly access NTDS.dit or equivalent credential stores; there are no additional access controls beyond standard role assignment.",
    },
    detect: {
      question:
        "Does your organisation alert on access to or enumeration of Active Directory credential databases (e.g., NTDS.dit access, replication API calls, suspicious kerberoasting activity)?",
      resilient_looks_like:
        "SIEM rules exist to detect NTDS.dit access attempts, unusual AD replication API calls, and kerberoasting patterns; alerts are triaged within a defined SLA.",
      vulnerable_looks_like:
        "Access to NTDS.dit and similar credential stores is not specifically monitored; credential dumping can proceed undetected after initial compromise.",
    },
  },
  "T1486": {
    prevent: {
      question:
        "Does your organisation maintain tested, offline or air-gapped backups of critical virtual machine infrastructure sufficient to restore within your operational SLA after ransomware encryption?",
      resilient_looks_like:
        "Offline or air-gapped backups of critical VM infrastructure are maintained and tested regularly; restoration procedures meet the defined recovery-time objective; encryption of VMs is a recoverable event.",
      vulnerable_looks_like:
        "Virtual machine infrastructure lacks offline backups, or restoration procedures are untested; encryption of VMs would cause prolonged operational disruption exceeding the organisation's recovery objectives.",
    },
    respond: {
      question:
        "Does your organisation have a ransomware response playbook that covers ESXi or equivalent hypervisor environments, including isolation and restoration sequencing?",
      resilient_looks_like:
        "A ransomware response playbook addresses hypervisor-level encryption; isolation, evidence preservation, and restoration sequencing are defined and tested.",
      vulnerable_looks_like:
        "The incident response capability does not specifically address hypervisor-level encryption; recovery sequencing and SLA targets are undefined or untested.",
    },
  },
};

const GENERIC_DESCRIPTIONS: Record<string, AxisDescription> = {
  prevent: {
    question:
      "Does your organisation have preventive controls for the identified attack technique?",
    resilient_looks_like:
      "Preventive controls are in place that would deny the attacker the ability to execute this step.",
    vulnerable_looks_like:
      "No preventive control is in place; the attack step can proceed if the attacker reaches this stage.",
  },
  detect: {
    question:
      "Does your organisation have detective controls that would alert on the identified attack technique?",
    resilient_looks_like:
      "Detective controls would generate a timely alert on attacker activity at this step, enabling a defensive response.",
    vulnerable_looks_like:
      "No detective control is in place; the attack step can proceed without generating an alert.",
  },
  respond: {
    question:
      "Does your organisation have a response playbook that covers the identified attack technique?",
    resilient_looks_like:
      "A response playbook exists that covers attacker activity at this step; the organisation can contain and eradicate the threat within a defined SLA.",
    vulnerable_looks_like:
      "No specific response playbook covers this technique; response would be ad hoc and slow.",
  },
};

function getTestability(
  mappingBasis: "CTID-mapped" | "analyst-asserted",
  frameworkRef: string,
): Testability {
  if (mappingBasis === "analyst-asserted") {
    const hiCtrl = HUMAN_IDENTITY_CONTROLS.find(
      (c) => c.framework_ref === frameworkRef,
    );
    if (hiCtrl) return hiCtrl.testability as Testability;
  }
  return "self-reported-only";
}

function getDescriptions(techniqueId: string, axis: string): AxisDescription {
  return (
    DESCRIPTIONS[techniqueId]?.[axis] ??
    GENERIC_DESCRIPTIONS[axis] ??
    GENERIC_DESCRIPTIONS["prevent"]!
  );
}

export function selfAssess(steps: AttackChainStep[]): SelfAssessmentEntry[] {
  const entries: SelfAssessmentEntry[] = [];

  for (const step of steps) {
    for (const ctrl of step.breaking_controls) {
      const descs = getDescriptions(step.attack_technique, ctrl.axis);
      entries.push({
        question: descs.question,
        maps_to_step: step.step,
        framework_ref: ctrl.framework_ref,
        mapping_basis: ctrl.mapping_basis,
        testability: getTestability(ctrl.mapping_basis, ctrl.framework_ref),
        resilient_looks_like: descs.resilient_looks_like,
        vulnerable_looks_like: descs.vulnerable_looks_like,
        evidence_tier_of_underlying_step: step.evidence_tier,
      });
    }
  }

  return entries;
}
