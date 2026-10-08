import Foundation

public enum PlanExport {
    /// Plain-text treatment framework for sharing (Messages, Mail, Notes, CRM paste).
    public static func text(plans: [ConditionPlan], selected: Set<String>, site: SiteContext, siteLabel: String, kb: KnowledgeBase) -> String {
        var out: [String] = []
        out.append("PHC TREATMENT FRAMEWORK")
        if !siteLabel.isEmpty { out.append("Site: \(siteLabel)") }
        var siteLine = "\(site.jurisdiction.rawValue) · planned \(Months.name(site.month))"
        if let dbh = site.dbhInches { siteLine += " · DBH \(formatDBH(dbh)) in." }
        if let loss = site.crownLossPercent { siteLine += " · crown loss \(loss)%" }
        out.append(siteLine)
        let siteFlags = [site.nearWater ? "near water" : nil, site.sensitiveSite ? "school/daycare/park" : nil,
                         site.publicProperty ? "public property" : nil, site.inBloom ? "in bloom" : nil].compactMap { $0 }
        if !siteFlags.isEmpty { out.append("Site factors: \(siteFlags.joined(separator: ", "))") }

        for plan in plans {
            out.append("")
            out.append("== \(plan.condition.name.uppercased()) ==")
            for f in plan.flags where f.level != .info || !f.text.hasPrefix("Content review") {
                out.append("\(marker(f.level)) \(f.text)")
            }
            for m in Mitigation.allCases {
                let chosen = plan.options(m).filter { selected.contains($0.id) }
                guard !chosen.isEmpty else { continue }
                out.append("")
                out.append("\(m.label):")
                for o in chosen {
                    var line = "• \(o.treatment.title) [\(o.applicationType.name)]"
                    if !o.treatment.months.isEmpty { line += " Window: \(Months.describe(o.treatment.months))." }
                    if let fq = o.treatment.frequency { line += " \(fq)." }
                    if let pr = o.treatment.protection { line += " Protection: \(pr)." }
                    if o.status == .notAdvised { line += " NOT ADVISED under current site conditions." }
                    out.append(line)
                    for n in o.treatment.notes { out.append("    - \(n)") }
                    for f in o.flags { out.append("    \(marker(f.level)) \(f.text)") }
                }
            }
        }

        let sched = PlanEngine.schedule(plans, selected: selected)
        if !sched.isEmpty {
            out.append("")
            out.append("== ANNUAL SCHEDULE ==")
            for entry in sched {
                out.append("\(Months.name(entry.month)): " + entry.items.joined(separator: "; "))
            }
        }
        out.append("")
        out.append(kb.meta.disclaimer)
        return out.joined(separator: "\n")
    }

    static func marker(_ level: Flag.Level) -> String {
        switch level {
        case .info: return "[i]"
        case .caution: return "[!]"
        case .stop: return "[X]"
        }
    }

    static func formatDBH(_ d: Double) -> String {
        d == d.rounded() ? String(Int(d)) : String(format: "%.1f", d)
    }
}
