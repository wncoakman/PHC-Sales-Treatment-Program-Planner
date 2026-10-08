import Testing
@testable import PHCKit

let kb = try! KnowledgeBase.bundled()

@Suite struct DataIntegrity {
    @Test func loadsAllConditions() {
        #expect(kb.conditions.count == 35)
    }

    @Test func referencesResolve() {
        var treatmentIds = Set<String>()
        for c in kb.conditions {
            #expect(kb.category(c.category) != nil, "\(c.id) category")
            for h in c.hostIds { #expect(kb.host(h) != nil, "\(c.id) host \(h)") }
            for l in c.lookalikeIds { #expect(kb.condition(l) != nil, "\(c.id) lookalike \(l)") }
            #expect(!c.treatments.isEmpty, "\(c.id) has no treatments")
            for t in c.treatments {
                #expect(kb.applicationType(t.applicationType) != nil, "\(t.id) type")
                #expect(t.months.allSatisfy { (1...12).contains($0) }, "\(t.id) months")
                #expect(treatmentIds.insert(t.id).inserted, "duplicate \(t.id)")
            }
        }
    }

    @Test func everyJurisdictionPresent() {
        for code in JurisdictionCode.allCases { #expect(kb.jurisdiction(code) != nil) }
    }

    @Test func hostFilterPutsSpecificFirst() {
        let ash = kb.conditions(forHost: "ash").map(\.id)
        #expect(ash.first == "anthracnose" || ash.prefix(3).contains("emerald-ash-borer"))
        #expect(ash.contains("drought"))
        #expect(!ash.contains("boxwood-blight"))
    }
}

@Suite struct Rules {
    func plan(_ id: String, _ site: SiteContext) -> ConditionPlan {
        PlanEngine.plan(for: kb.condition(id)!, site: site, kb: kb)
    }

    @Test func eabCrownLossOverMaxBlocksChemical() {
        let p = plan("emerald-ash-borer", SiteContext(month: 5, crownLossPercent: 60))
        #expect(p.options(.chemical).allSatisfy { $0.status == .notAdvised })
        #expect(p.options(.removal).allSatisfy { $0.status != .notAdvised })
        #expect(p.flags.contains { $0.level == .stop })
    }

    @Test func eabCautionBetweenThresholds() {
        let p = plan("emerald-ash-borer", SiteContext(month: 5, crownLossPercent: 40))
        #expect(p.options.first { $0.id == "eab-inject" }?.status == .inWindow)
        #expect(p.flags.contains { $0.level == .caution && $0.text.contains("30%") })
    }

    @Test func hwaDormantSeasonBlocksChemical() {
        let p = plan("hemlock-woolly-adelgid", SiteContext(month: 8))
        #expect(p.options(.chemical).allSatisfy { $0.status == .notAdvised })
    }

    @Test func outOfWindowGivesNextMonth() {
        let p = plan("cedar-apple-rust", SiteContext(month: 9))
        let foliar = p.options.first { $0.id == "ru-foliar" }!
        #expect(foliar.status == .outOfWindow)
        #expect(foliar.nextWindowMonth == 4)
        // Wraps across the year end.
        let galls = p.options.first { $0.id == "ru-galls" }!
        #expect(galls.nextWindowMonth == 1)
    }

    @Test func marylandNeonicFlag() {
        let md = plan("crapemyrtle-bark-scale", SiteContext(jurisdiction: .MD, month: 4))
        let va = plan("crapemyrtle-bark-scale", SiteContext(jurisdiction: .VA, month: 4))
        let drench = { (p: ConditionPlan) in p.options.first { $0.id == "cmbs-drench" }! }
        #expect(drench(md).flags.contains { $0.text.contains("neonicotinoid") })
        #expect(!drench(va).flags.contains { $0.text.contains("neonicotinoid") })
    }

    @Test func bloomStopsPollinatorHazards() {
        let p = plan("japanese-beetle", SiteContext(month: 5, inBloom: true))
        #expect(p.options.first { $0.id == "jb-systemic" }!.flags.contains { $0.level == .stop })
    }

    @Test func nearWaterSkipsInjections() {
        let p = plan("emerald-ash-borer", SiteContext(jurisdiction: .MD, month: 5, nearWater: true))
        #expect(!p.options.first { $0.id == "eab-inject" }!.flags.contains { $0.text.contains("Critical Area") })
        #expect(p.options.first { $0.id == "eab-basal" }!.flags.contains { $0.text.contains("Critical Area") })
    }

    @Test func costShareEligibility() {
        let small = plan("emerald-ash-borer", SiteContext(month: 5, dbhInches: 8))
        let big = plan("emerald-ash-borer", SiteContext(month: 5, dbhInches: 18))
        #expect(small.flags.contains { $0.text.hasPrefix("Cost-share not eligible") })
        #expect(big.flags.contains { $0.text.hasPrefix("Cost-share eligible") })
        let mdPrivate = plan("emerald-ash-borer", SiteContext(jurisdiction: .MD, month: 5))
        #expect(mdPrivate.flags.contains { $0.text.contains("not eligible here") })
    }

    @Test func dcSlfRegulatoryNote() {
        let p = plan("spotted-lanternfly", SiteContext(jurisdiction: .DC, month: 6))
        #expect(p.flags.contains { $0.text.contains("DOEE discourages") })
    }

    @Test func scheduleAndExport() {
        let site = SiteContext(month: 4, dbhInches: 20, crownLossPercent: 10)
        let plans = ["emerald-ash-borer", "drought"].map { plan($0, site) }
        let selected: Set = ["eab-inject", "dr-water"]
        let sched = PlanEngine.schedule(plans, selected: selected)
        #expect(sched.map(\.month) == [4, 5, 6, 7, 8, 9])
        let text = PlanExport.text(plans: plans, selected: selected, site: site, siteLabel: "Test", kb: kb)
        #expect(text.contains("Macro-injection"))
        #expect(text.contains("ANNUAL SCHEDULE"))
        #expect(!text.contains("Content review"))
    }
}

@Suite struct MonthText {
    @Test func ranges() {
        #expect(Months.describe([3, 4, 5, 9, 10]) == "Mar–May, Sep–Oct")
        #expect(Months.describe([11, 12, 1, 2]) == "Nov–Feb")
        #expect(Months.describe([]) == "Any time")
        #expect(Months.describe(Array(1...12)) == "Year-round")
        #expect(Months.describe([6]) == "Jun")
    }
}
