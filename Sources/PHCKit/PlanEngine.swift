import Foundation

/// Site conditions that drive the treatment framework.
public struct SiteContext: Equatable, Sendable {
    public var jurisdiction: JurisdictionCode = .VA
    /// Month (1–12) the work is being planned for.
    public var month: Int
    public var dbhInches: Double?
    /// Estimated crown loss / dieback, 0–100.
    public var crownLossPercent: Int?
    public var nearWater = false
    public var sensitiveSite = false
    public var publicProperty = false
    public var inBloom = false

    public init(jurisdiction: JurisdictionCode = .VA, month: Int, dbhInches: Double? = nil, crownLossPercent: Int? = nil,
                nearWater: Bool = false, sensitiveSite: Bool = false, publicProperty: Bool = false, inBloom: Bool = false) {
        self.jurisdiction = jurisdiction
        self.month = month
        self.dbhInches = dbhInches
        self.crownLossPercent = crownLossPercent
        self.nearWater = nearWater
        self.sensitiveSite = sensitiveSite
        self.publicProperty = publicProperty
        self.inBloom = inBloom
    }
}

public enum OptionStatus: Int, Comparable, Sendable {
    case inWindow, outOfWindow, notAdvised
    public static func < (a: Self, b: Self) -> Bool { a.rawValue < b.rawValue }
}

public struct Flag: Hashable, Sendable {
    public enum Level: Int, Sendable { case info, caution, stop }
    public let level: Level
    public let text: String
}

public struct OptionAssessment: Identifiable, Sendable {
    public let treatment: Treatment
    public let applicationType: ApplicationType
    public let status: OptionStatus
    /// Next month the option's window opens, when currently out of window.
    public let nextWindowMonth: Int?
    public let flags: [Flag]
    public var id: String { treatment.id }
    public var mitigation: Mitigation { applicationType.mitigation }
}

public struct ConditionPlan: Identifiable, Sendable {
    public let condition: Condition
    public let flags: [Flag]
    public let options: [OptionAssessment]
    public var id: String { condition.id }

    public func options(_ m: Mitigation) -> [OptionAssessment] { options.filter { $0.mitigation == m } }
}

public enum PlanEngine {
    static let neonicotinoids = ["imidacloprid", "dinotefuran", "clothianidin", "thiamethoxam"]
    static let pollinatorHazards = neonicotinoids + ["bifenthrin", "permethrin", "pyrethroid", "carbaryl", "spinosad", "abamectin", "pyriproxyfen"]
    static let aquaticHazards = ["bifenthrin", "permethrin", "pyrethroid", "chlorothalonil", "diflubenzuron", "copper", "carbaryl", "abamectin", "trifloxystrobin"]
    static let enclosedMethods: Set<String> = ["microInjection", "macroInjection"]

    public static func plan(for condition: Condition, site: SiteContext, kb: KnowledgeBase) -> ConditionPlan {
        let juris = kb.jurisdiction(site.jurisdiction)
        var flags: [Flag] = []

        if condition.labConfirmation {
            flags.append(Flag(level: .caution, text: "Confirm diagnosis by lab test before committing to a treatment program."))
        }
        if !condition.curable {
            flags.append(Flag(level: .info, text: "No cure. Management is suppressive or cultural."))
        }
        if !condition.lookalikeIds.isEmpty {
            let names = condition.lookalikeIds.compactMap { kb.condition($0)?.name }
            flags.append(Flag(level: .info, text: "Rule out look-alikes: \(names.joined(separator: ", "))."))
        }
        let crownStop = crownLossExceeded(condition, site)
        if crownStop {
            flags.append(Flag(level: .stop, text: "Crown loss above \(condition.maxCrownLossPercent!)%: chemical protection not advised; plan removal."))
        } else if let caution = condition.cautionCrownLossPercent, let loss = site.crownLossPercent, loss > caution {
            flags.append(Flag(level: .caution, text: "Crown loss above \(caution)%: treatment success declines; VA guidance treats below \(caution)%."))
        } else if condition.maxCrownLossPercent != nil, site.crownLossPercent == nil {
            flags.append(Flag(level: .caution, text: "Estimate crown loss: treatment is not advised above \(condition.maxCrownLossPercent!)%."))
        }
        if condition.noTreatmentMonths.contains(site.month) {
            flags.append(Flag(level: .stop, text: condition.noTreatmentReason ?? "Treatment not advised this month."))
        }
        for note in condition.regulatory where note.jurisdictions.contains(site.jurisdiction) {
            flags.append(Flag(level: .info, text: note.text))
        }
        for cs in condition.costShare where cs.jurisdiction == site.jurisdiction {
            flags.append(costShareFlag(cs, site))
        }
        flags += condition.warnings.map { Flag(level: .caution, text: $0) }
        flags += condition.reviewFlags.map { Flag(level: .info, text: "Content review: \($0)") }

        let options = condition.treatments.map { t -> OptionAssessment in
            let type = kb.applicationType(t.applicationType) ?? ApplicationType(id: t.applicationType, name: t.applicationType)
            return assess(t, type: type, condition: condition, site: site, jurisdiction: juris, crownStop: crownStop)
        }
        return ConditionPlan(condition: condition, flags: flags, options: options)
    }

    static func assess(_ t: Treatment, type: ApplicationType, condition: Condition, site: SiteContext,
                       jurisdiction: Jurisdiction?, crownStop: Bool) -> OptionAssessment {
        let chemical = type.mitigation == .chemical
        let text = t.ingredientText
        var flags: [Flag] = []
        var status: OptionStatus = .inWindow
        var next: Int?

        if !t.months.isEmpty && !t.months.contains(site.month) {
            status = .outOfWindow
            next = (1...12).map { (site.month - 1 + $0) % 12 + 1 }.first { t.months.contains($0) }
        }
        if chemical && condition.noTreatmentMonths.contains(site.month) { status = .notAdvised }
        if chemical && crownStop { status = .notAdvised }

        if t.suppressiveOnly { flags.append(Flag(level: .info, text: "Suppressive only; repeat treatments expected.")) }
        if t.requiresLicense { flags.append(Flag(level: .caution, text: "Certified applicator required; check restricted-use status.")) }

        if chemical {
            let neonic = neonicotinoids.contains { text.contains($0) }
            if neonic, site.jurisdiction == .MD, let rule = jurisdiction?.neonicotinoid {
                flags.append(Flag(level: .caution, text: rule))
            }
            if site.inBloom || condition.bloomSensitive, pollinatorHazards.contains(where: { text.contains($0) }) {
                flags.append(Flag(level: site.inBloom ? .stop : .caution,
                                  text: "Pollinator hazard: do not apply to bee-attractive plants before or during bloom."))
            }
            if site.nearWater, !enclosedMethods.contains(type.id) {
                if aquaticHazards.contains(where: { text.contains($0) }) {
                    flags.append(Flag(level: .caution, text: "Aquatic toxicity: observe label buffers from water."))
                }
                if let rule = jurisdiction?.nearWater { flags.append(Flag(level: .caution, text: rule)) }
            }
            if site.sensitiveSite, let rule = jurisdiction?.sensitiveSite {
                flags.append(Flag(level: .caution, text: rule))
            }
            if type.id == "foliar" || type.id == "dormantOil" || type.id == "barkSpray" {
                flags.append(Flag(level: .info, text: "Spray only with wind under 10 mph and temperature under 90°F."))
            }
            if text.contains("pyrethroid") || text.contains("bifenthrin") || text.contains("permethrin") {
                flags.append(Flag(level: .info, text: "Pyrethroids can trigger spider mite flare-ups; monitor after application."))
            }
        }
        return OptionAssessment(treatment: t, applicationType: type, status: status, nextWindowMonth: next, flags: flags)
    }

    static func crownLossExceeded(_ c: Condition, _ site: SiteContext) -> Bool {
        guard let max = c.maxCrownLossPercent, let loss = site.crownLossPercent else { return false }
        return loss > max
    }

    static func costShareFlag(_ cs: CostShare, _ site: SiteContext) -> Flag {
        if cs.publicOnly == true && !site.publicProperty {
            return Flag(level: .info, text: "Cost-share (public land only, not eligible here): \(cs.text)")
        }
        if let min = cs.minDBH {
            guard let dbh = site.dbhInches else {
                return Flag(level: .info, text: "Possible cost-share (needs DBH ≥ \(Int(min)) in.): \(cs.text)")
            }
            if dbh < min { return Flag(level: .info, text: "Cost-share not eligible (DBH under \(Int(min)) in.): \(cs.text)") }
        }
        return Flag(level: .info, text: "Cost-share eligible: \(cs.text)")
    }

    /// Month-by-month schedule of the chosen options across all planned conditions.
    public static func schedule(_ plans: [ConditionPlan], selected: Set<String>) -> [(month: Int, items: [String])] {
        (1...12).compactMap { m in
            let items = plans.flatMap { p in
                p.options.filter { selected.contains($0.id) && $0.status != .notAdvised && $0.treatment.months.contains(m) }
                    .map { "\(p.condition.name): \($0.treatment.title) (\($0.applicationType.name))" }
            }
            return items.isEmpty ? nil : (m, items)
        }
    }
}

