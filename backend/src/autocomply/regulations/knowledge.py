from __future__ import annotations

import re
from typing import Dict, Iterable, List

from src.api.models.compliance_models import RegulatorySource
from src.api.models.decision import RegulatoryReference
from src.rag.service import normalize_scores
from src.autocomply.regulations.csf_practitioner_seed import (
    get_csf_practitioner_rules,
    get_csf_practitioner_sources,
)
from src.autocomply.regulations.ohio_tddd_seed import (
    get_ohio_tddd_rules,
    get_ohio_tddd_sources,
)
from src.autocomply.regulations.ny_pharmacy_license_seed import (
    get_ny_pharmacy_license_rules,
    get_ny_pharmacy_license_sources,
)
from src.autocomply.regulations.csf_facility_seed import (
    get_csf_facility_rules,
    get_csf_facility_sources,
)


class RegulatoryKnowledge:
    """
    Central registry for regulatory snippets used by CSF, license, and RAG endpoints.

    Initial implementation is in-memory and static, but the interface is designed so it
    can later be backed by a vector store or external RAG service.
    """

    def __init__(self) -> None:
        # Keyed primarily by document id, which matches existing regulatory_references IDs.
        self._sources_by_id: Dict[str, RegulatorySource] = {}

        self._seed_static_sources()

    def _seed_static_sources(self) -> None:
        # NOTE: Use the same IDs already used in tests and domain code, e.g. "csf_hospital_form".
        self._add(
            RegulatorySource(
                id="csf_hospital_form",
                title="Hospital CSF – core requirements",
                snippet="Core rules and attestations for hospital CSF evaluations.",
                jurisdiction="OH",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="csf_facility_form",
                title="Facility CSF – core requirements",
                snippet="Guidance and required fields for facility CSF evaluations.",
                jurisdiction="OH",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="csf_practitioner_form",
                title="Practitioner CSF – core requirements",
                snippet="Practitioner-specific CSF requirements and attestations.",
                jurisdiction="US",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="csf_ems_form",
                title="EMS CSF",
                snippet="EMS-specific CSF requirements and attestations.",
                jurisdiction="US",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="csf_researcher_form",
                title="Researcher CSF",
                snippet="Researcher CSF requirements and attestations.",
                jurisdiction="US",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="ohio-tddd-core",
                title="Ohio TDDD License Rules",
                snippet="Ohio TDDD licensing requirements, including expiry and ship-to restrictions.",
                jurisdiction="US-OH",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="ohio_tddd_rules",
                title="Ohio TDDD License Rules",
                snippet="Ohio TDDD licensing requirements, including expiry and ship-to restrictions.",
                jurisdiction="US-OH",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="ny-pharmacy-core",
                title="NY pharmacy license required and must be active",
                snippet="NY pharmacy licensing standards, including state-specific dispensing rules.",
                jurisdiction="NY",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="ny_pharmacy_core",
                title="NY pharmacy license required and must be active",
                snippet="NY pharmacy licensing standards, including state-specific dispensing rules.",
                jurisdiction="NY",
                citation=None,
            )
        )
        self._add(
            RegulatorySource(
                id="ny_pharmacy_rules",
                title="NY pharmacy license required and must be active",
                snippet="NY pharmacy licensing standards, including state-specific dispensing rules.",
                jurisdiction="NY",
                citation=None,
            )
        )

        # Seed CSF Practitioner knowledge base
        self._seed_csf_practitioner_rules()
        
        # Seed Ohio TDDD license knowledge base
        self._seed_ohio_tddd_rules()
        
        # Seed NY Pharmacy License knowledge base
        self._seed_ny_pharmacy_license_rules()
        
        # Seed CSF Facility knowledge base
        self._seed_csf_facility_rules()

    def _seed_csf_practitioner_rules(self) -> None:
        """
        Load CSF Practitioner rules from the seed dataset.
        
        Transforms rule objects into RegulatorySource format for RAG endpoints.
        """
        rules = get_csf_practitioner_rules()
        sources = get_csf_practitioner_sources()
        
        for rule in rules:
            # Combine requirement + rationale for snippet
            snippet = f"{rule['requirement']} — {rule['rationale']}"
            
            self._add(
                RegulatorySource(
                    id=rule["id"],
                    label=rule["title"],
                    jurisdiction=rule["jurisdiction"],
                    citation=rule["citation_label"],
                    snippet=snippet,
                    score=1.0,
                    raw_score=1.0,
                    url=rule.get("source_url"),
                    source_type="rule",
                )
            )
        
        for source in sources:
            self._add(
                RegulatorySource(
                    id=source["id"],
                    label=source["title"],
                    jurisdiction=source["jurisdiction"],
                    citation=source["citation"],
                    snippet=source["snippet"],
                    score=1.0,
                    raw_score=1.0,
                    url=source["url"],
                    source_type="source",
                )
            )

    def _seed_ohio_tddd_rules(self) -> None:
        """
        Load Ohio TDDD rules from the seed dataset.
        
        Transforms rule objects into RegulatorySource format for RAG endpoints.
        """
        rules = get_ohio_tddd_rules()
        sources = get_ohio_tddd_sources()
        
        for rule in rules:
            snippet = f"{rule['requirement']} — {rule['rationale']}"
            
            self._add(
                RegulatorySource(
                    id=rule["id"],
                    label=rule["title"],
                    jurisdiction=rule["jurisdiction"],
                    citation=rule["citation_label"],
                    snippet=snippet,
                    score=1.0,
                    raw_score=1.0,
                    url=rule.get("source_url"),
                    source_type="rule",
                )
            )
        
        for source in sources:
            self._add(
                RegulatorySource(
                    id=source["id"],
                    label=source["title"],
                    jurisdiction=source["jurisdiction"],
                    citation=source["citation"],
                    snippet=source["snippet"],
                    score=1.0,
                    raw_score=1.0,
                    url=source["url"],
                    source_type="source",
                )
            )

    def _seed_ny_pharmacy_license_rules(self) -> None:
        """
        Load NY Pharmacy License rules from the seed dataset.
        
        Transforms rule objects into RegulatorySource format for RAG endpoints.
        """
        rules = get_ny_pharmacy_license_rules()
        sources = get_ny_pharmacy_license_sources()
        
        for rule in rules:
            snippet = f"{rule['requirement']} — {rule['rationale']}"
            
            self._add(
                RegulatorySource(
                    id=rule["id"],
                    label=rule["title"],
                    jurisdiction=rule["jurisdiction"],
                    citation=rule["citation_label"],
                    snippet=snippet,
                    score=1.0,
                    raw_score=1.0,
                    url=rule.get("source_url"),
                    source_type="rule",
                )
            )
        
        for source in sources:
            self._add(
                RegulatorySource(
                    id=source["id"],
                    label=source["title"],
                    jurisdiction=source["jurisdiction"],
                    citation=source["citation"],
                    snippet=source["snippet"],
                    score=1.0,
                    raw_score=1.0,
                    url=source["url"],
                    source_type="source",
                )
            )

    def _seed_csf_facility_rules(self) -> None:
        """
        Load CSF Facility rules from the seed dataset.
        
        Transforms rule objects into RegulatorySource format for RAG endpoints.
        """
        rules = get_csf_facility_rules()
        sources = get_csf_facility_sources()
        
        for rule in rules:
            snippet = f"{rule['requirement']} — {rule['rationale']}"
            
            self._add(
                RegulatorySource(
                    id=rule["id"],
                    label=rule["title"],
                    jurisdiction=rule["jurisdiction"],
                    citation=rule["citation_label"],
                    snippet=snippet,
                    score=1.0,
                    raw_score=1.0,
                    url=rule.get("source_url"),
                    source_type="rule",
                )
            )
        
        for source in sources:
            self._add(
                RegulatorySource(
                    id=source["id"],
                    label=source["title"],
                    jurisdiction=source["jurisdiction"],
                    citation=source["citation"],
                    snippet=source["snippet"],
                    score=1.0,
                    raw_score=1.0,
                    url=source["url"],
                    source_type="source",
                )
            )

    def _add(self, source: RegulatorySource) -> None:
        normalized = source.model_copy(
            update={
                "score": source.score if source.score is not None else 1.0,
                "raw_score": source.raw_score if source.raw_score is not None else 1.0,
            }
        )
        self._sources_by_id[source.id] = normalized

    def get_sources_for_doc_ids(self, doc_ids: Iterable[str]) -> List[RegulatorySource]:
        ids = list(doc_ids)
        return [self._sources_by_id[i] for i in ids if i in self._sources_by_id]

    def search_sources(
        self,
        query: str,
        limit: int = 5,
    ) -> list[RegulatorySource]:
        """
        Very simple lexical search over title + snippet.

        This is intentionally minimal but provides a clear hook
        that can later be backed by a vector store / embeddings.
        """
        q = query.strip().lower()
        if not q:
            return []

        terms = [t for t in re.split(r"\s+", q) if t]
        if not terms:
            return []

        def score(source: RegulatorySource) -> int:
            haystack = f"{getattr(source, 'title', '')} {getattr(source, 'snippet', '')}".lower()
            s = 0
            for t in terms:
                if t in haystack:
                    s += 1
            return s

        scored = [
            (score(src), src)
            for src in self._sources_by_id.values()
        ]

        # Keep only positive-score hits and sort descending
        scored = [pair for pair in scored if pair[0] > 0]
        scored.sort(key=lambda pair: pair[0], reverse=True)

        raw_scores = [float(pair[0]) for pair in scored[:limit]]
        norm_scores = normalize_scores(raw_scores)

        sources: List[RegulatorySource] = []
        for (raw, src), norm in zip(scored[:limit], norm_scores):
            sources.append(
                src.model_copy(
                    update={"raw_score": float(raw), "score": round(norm, 4)},
                    deep=True,
                )
            )

        return sources

    def get_context_for_engine(
        self, *, engine_family: str, decision_type: str
    ) -> List[RegulatorySource]:
        """
        Convenience method used by RAG endpoints. Maps engine/decision types
        to one or more document ids, then returns the associated sources.
        """
        key = f"{engine_family}:{decision_type}"

        # Keep this mapping small and explicit for now.
        mapping: Dict[str, List[str]] = {
            "csf:csf_hospital": ["csf_hospital_form"],
            "csf:csf_facility": [
                "csf_facility_form",
                # CSF Facility rule IDs
                "csf_facility_dea_001",
                "csf_facility_state_002",
                "csf_facility_responsible_003",
                "csf_facility_storage_004",
                "csf_facility_recordkeeping_005",
                "csf_facility_inventory_006",
                "csf_facility_diversion_007",
                "csf_facility_staff_008",
                "csf_facility_theft_009",
                "csf_facility_inspection_010",
                "csf_facility_renewal_011",
                "csf_facility_formulary_012",
                "csf_facility_automation_013",
                "csf_facility_disposal_014",
                "csf_facility_emergency_015",
                # CSF Facility source IDs
                "csf_facility_cfr_1301",
                "csf_facility_cfr_1304",
                "csf_facility_security_standards",
                "csf_facility_diversion_guidance",
                "csf_facility_practitioner_manual",
                "csf_facility_disposal_rule",
                "csf_facility_inspection_procedures",
                "csf_facility_state_licensing",
                "csf_facility_jcaho_standards",
                "csf_facility_adc_guidance",
                "csf_facility_emergency_protocols",
                "csf_facility_cms_requirements",
            ],
            "csf:csf_practitioner": [
                "csf_practitioner_form",
                # CSF Practitioner rule IDs
                "csf_pract_dea_001",
                "csf_pract_state_002",
                "csf_pract_schedule_003",
                "csf_pract_exp_004",
                "csf_pract_history_005",
                "csf_pract_attestation_006",
                "csf_pract_multistate_007",
                "csf_pract_npi_008",
                "csf_pract_renewal_009",
                "csf_pract_cds_010",
                "csf_pract_training_011",
                "csf_pract_storage_012",
                # CSF Practitioner source IDs
                "csf_pract_dea_cfr_1301",
                "csf_pract_state_medical_board",
                "csf_pract_dea_schedules",
                "csf_pract_npdb",
                "csf_pract_pdmp_programs",
                "csf_pract_npi_registry",
            ],
            "csf:csf_ems": ["csf_ems_form"],
            "csf:csf_researcher": ["csf_researcher_form"],
            "license:ohio_tddd": [
                "ohio_tddd_rules",
                "ohio-tddd-core",
                # Ohio TDDD rule IDs
                "ohio_tddd_license_001",
                "ohio_tddd_category_002",
                "ohio_tddd_rph_003",
                "ohio_tddd_storage_004",
                "ohio_tddd_inspection_005",
                "ohio_tddd_dispensing_006",
                "ohio_tddd_wholesale_007",
                "ohio_tddd_renewal_008",
                "ohio_tddd_reporting_009",
                "ohio_tddd_training_010",
                # Ohio TDDD source IDs
                "ohio_tddd_statute_base",
                "ohio_tddd_oac_categories",
                "ohio_tddd_security_standards",
                "ohio_tddd_oarrs_guide",
                "ohio_tddd_responsible_person",
                "ohio_tddd_inspection_procedures",
                "ohio_tddd_wholesale_pedigree",
            ],
            "license:license_ohio_tddd": [
                "ohio_tddd_rules",
                "ohio-tddd-core",
                # Ohio TDDD rule IDs (legacy mapping)
                "ohio_tddd_license_001",
                "ohio_tddd_category_002",
                "ohio_tddd_rph_003",
                "ohio_tddd_storage_004",
                "ohio_tddd_inspection_005",
                "ohio_tddd_dispensing_006",
                "ohio_tddd_wholesale_007",
                "ohio_tddd_renewal_008",
                "ohio_tddd_reporting_009",
                "ohio_tddd_training_010",
                # Ohio TDDD source IDs
                "ohio_tddd_statute_base",
                "ohio_tddd_oac_categories",
                "ohio_tddd_security_standards",
                "ohio_tddd_oarrs_guide",
                "ohio_tddd_responsible_person",
                "ohio_tddd_inspection_procedures",
                "ohio_tddd_wholesale_pedigree",
            ],
            "license:ny_pharmacy_license": [
                "ny_pharmacy_core",
                "ny-pharmacy-core",
                "ny_pharmacy_rules",
                # NY Pharmacy License rule IDs
                "ny_pharm_license_001",
                "ny_pharm_pharmacist_002",
                "ny_pharm_registration_003",
                "ny_pharm_controlled_004",
                "ny_pharm_facility_005",
                "ny_pharm_pdmp_006",
                "ny_pharm_staffing_007",
                "ny_pharm_records_008",
                "ny_pharm_compounding_009",
                "ny_pharm_renewal_010",
                "ny_pharm_ce_011",
                "ny_pharm_patient_counseling_012",
                "ny_pharm_immunizations_013",
                "ny_pharm_automation_014",
                # NY Pharmacy License source IDs
                "ny_pharm_education_law",
                "ny_pharm_nycrr_63",
                "ny_pharm_controlled_substances",
                "ny_pharm_istop_guide",
                "ny_pharm_compounding_standards",
                "ny_pharm_facility_inspection",
                "ny_pharm_technician_registration",
                "ny_pharm_immunization_protocol",
                "ny_pharm_opioid_guidelines",
                "ny_pharm_covid_protocols",
            ],
            "license:license_ny_pharmacy": [
                "ny_pharmacy_core",
                "ny-pharmacy-core",
                "ny_pharmacy_rules",
                # NY Pharmacy License rule IDs (legacy mapping)
                "ny_pharm_license_001",
                "ny_pharm_pharmacist_002",
                "ny_pharm_registration_003",
                "ny_pharm_controlled_004",
                "ny_pharm_facility_005",
                "ny_pharm_pdmp_006",
                "ny_pharm_staffing_007",
                "ny_pharm_records_008",
                "ny_pharm_compounding_009",
                "ny_pharm_renewal_010",
                "ny_pharm_ce_011",
                "ny_pharm_patient_counseling_012",
                "ny_pharm_immunizations_013",
                "ny_pharm_automation_014",
                # NY Pharmacy License source IDs
                "ny_pharm_education_law",
                "ny_pharm_nycrr_63",
                "ny_pharm_controlled_substances",
                "ny_pharm_istop_guide",
                "ny_pharm_compounding_standards",
                "ny_pharm_facility_inspection",
                "ny_pharm_technician_registration",
                "ny_pharm_immunization_protocol",
                "ny_pharm_opioid_guidelines",
                "ny_pharm_covid_protocols",
            ],
        }

        doc_ids = mapping.get(key, [])
        return self.get_sources_for_doc_ids(doc_ids)


# Singleton-style accessor to avoid repeated construction.
_GLOBAL_REGULATORY_KNOWLEDGE: RegulatoryKnowledge | None = None


def get_regulatory_knowledge() -> RegulatoryKnowledge:
    global _GLOBAL_REGULATORY_KNOWLEDGE
    if _GLOBAL_REGULATORY_KNOWLEDGE is None:
        _GLOBAL_REGULATORY_KNOWLEDGE = RegulatoryKnowledge()
    return _GLOBAL_REGULATORY_KNOWLEDGE


def sources_to_regulatory_references(
    sources: Iterable[RegulatorySource],
) -> List[RegulatoryReference]:
    """Helper to mirror legacy RegulatoryReference objects from sources."""

    references: List[RegulatoryReference] = []
    for src in sources:
        references.append(
            RegulatoryReference(
                id=src.id or "",
                jurisdiction=src.jurisdiction,
                source=src.label,
                citation=getattr(src, "citation", None),
                label=src.label or (src.id or ""),
            )
        )
    return references
