import SwiftUI
import PHCKit

struct PlanResultView: View {
    let kb: KnowledgeBase
    @Bindable var plan: PlanModel

    var plans: [ConditionPlan] {
        plan.conditionIds.compactMap { kb.condition($0) }.map { PlanEngine.plan(for: $0, site: plan.site, kb: kb) }
    }

    var body: some View {
        let plans = plans
        List {
            ForEach(plans) { p in
                Section(p.condition.name) {
                    ForEach(p.flags.filter { !$0.text.hasPrefix("Content review") }, id: \.self) { FlagRow(flag: $0) }
                    ForEach(Mitigation.allCases, id: \.self) { m in
                        let opts = p.options(m)
                        if !opts.isEmpty {
                            Text(m.label).font(.subheadline.bold()).padding(.top, 4)
                            ForEach(opts) { o in
                                OptionRow(option: o, month: plan.site.month, isOn: binding(o.id))
                            }
                        }
                    }
                }
            }
            let sched = PlanEngine.schedule(plans, selected: plan.selected)
            if !sched.isEmpty {
                Section("Annual schedule (selected options)") {
                    ForEach(sched, id: \.month) { entry in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(Months.name(entry.month)).bold()
                            ForEach(entry.items, id: \.self) { Text($0).font(.caption) }
                        }
                    }
                }
            }
            Section { Text(kb.meta.disclaimer).font(.caption).foregroundStyle(.secondary) }
        }
        .navigationTitle("Framework")
        .toolbar {
            ShareLink(item: PlanExport.text(plans: plans, selected: plan.selected, site: plan.site,
                                            siteLabel: plan.siteLabel, kb: kb))
        }
    }

    func binding(_ id: String) -> Binding<Bool> {
        Binding(get: { plan.selected.contains(id) },
                set: { if $0 { plan.selected.insert(id) } else { plan.selected.remove(id) } })
    }
}

struct OptionRow: View {
    let option: OptionAssessment
    let month: Int
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 3) {
                Text(option.treatment.title)
                Text(option.applicationType.name).font(.caption).foregroundStyle(.secondary)
                Text(statusText).font(.caption.bold()).foregroundStyle(statusColor)
                if let f = option.treatment.frequency { Text(f).font(.caption) }
                if let p = option.treatment.protection { Text("Protection: \(p)").font(.caption) }
                Text(option.treatment.purpose).font(.caption)
                ForEach(option.treatment.notes, id: \.self) { Text("• \($0)").font(.caption) }
                ForEach(option.flags, id: \.self) { FlagRow(flag: $0) }
            }
        }
    }

    var statusText: String {
        let window = option.treatment.months.isEmpty ? "Any time" : Months.describe(option.treatment.months)
        switch option.status {
        case .inWindow: return "In window (\(window))"
        case .outOfWindow: return "Out of window: next \(option.nextWindowMonth.map(Months.name) ?? "?") (\(window))"
        case .notAdvised: return "Not advised under current conditions"
        }
    }

    var statusColor: Color {
        switch option.status {
        case .inWindow: return .green
        case .outOfWindow: return .orange
        case .notAdvised: return .red
        }
    }
}

struct FlagRow: View {
    let flag: Flag

    var body: some View {
        Label {
            Text(flag.text).font(.caption)
        } icon: {
            switch flag.level {
            case .info: Image(systemName: "info.circle").foregroundStyle(.blue)
            case .caution: Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange)
            case .stop: Image(systemName: "xmark.octagon").foregroundStyle(.red)
            }
        }
    }
}
