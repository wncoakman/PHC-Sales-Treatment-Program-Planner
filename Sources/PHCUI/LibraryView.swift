import SwiftUI
import PHCKit

struct LibraryView: View {
    let kb: KnowledgeBase
    @State private var query = ""

    var body: some View {
        List {
            ForEach(kb.categories) { cat in
                let items = kb.conditions.filter { $0.category == cat.id && (query.isEmpty || $0.matches(query)) }
                if !items.isEmpty {
                    Section(cat.name) {
                        ForEach(items) { c in
                            NavigationLink(c.name) { ConditionDetailView(kb: kb, condition: c) }
                        }
                    }
                }
            }
        }
        .searchable(text: $query, prompt: "Name or symptom")
        .navigationTitle("Pests & Diseases")
    }
}

struct ConditionDetailView: View {
    let kb: KnowledgeBase
    let condition: Condition

    var body: some View {
        List {
            Section {
                if let s = condition.scientificName { Text(s).italic() }
                Text("Hosts: " + (condition.hostIds.compactMap { kb.host($0)?.name } + (condition.generalist ? ["many others"] : []))
                    .joined(separator: ", "))
                if let n = condition.hostNote { Text(n).font(.caption) }
                if !condition.activeMonths.isEmpty { Text("Active: \(Months.describe(condition.activeMonths))") }
                if let p = condition.peakNote { Text(p).font(.caption) }
            }
            bullets("Identification", condition.symptoms)
            bullets("Biology", condition.biology)
            ForEach(Mitigation.allCases, id: \.self) { m in
                let opts = condition.treatments.filter { kb.applicationType($0.applicationType)?.mitigation == m }
                if !opts.isEmpty {
                    Section(m.label) {
                        ForEach(opts) { t in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(t.title)
                                Text("\(kb.applicationType(t.applicationType)?.name ?? t.applicationType) · \(Months.describe(t.months))")
                                    .font(.caption).foregroundStyle(.secondary)
                                if let f = t.frequency { Text(f).font(.caption) }
                                Text(t.purpose).font(.caption)
                                ForEach(t.notes, id: \.self) { Text("• \($0)").font(.caption) }
                            }
                        }
                    }
                }
            }
            if !condition.lookalikeIds.isEmpty {
                Section("Look-alikes") {
                    ForEach(condition.lookalikeIds, id: \.self) { id in
                        if let c = kb.condition(id) { NavigationLink(c.name) { ConditionDetailView(kb: kb, condition: c) } }
                    }
                }
            }
            if !condition.regulatory.isEmpty {
                Section("Regulatory") {
                    ForEach(condition.regulatory, id: \.self) { r in
                        Text("\(r.jurisdictions.map(\.rawValue).joined(separator: "/")): \(r.text)").font(.caption)
                    }
                }
            }
            if !condition.costShare.isEmpty {
                Section("Cost-share") {
                    ForEach(condition.costShare, id: \.self) { Text("\($0.jurisdiction.rawValue): \($0.text)").font(.caption) }
                }
            }
            bullets("Warnings", condition.warnings)
            bullets("Content review flags", condition.reviewFlags)
            bullets("Sources", condition.sources)
        }
        .navigationTitle(condition.name)
    }

    @ViewBuilder func bullets(_ title: String, _ items: [String]) -> some View {
        if !items.isEmpty {
            Section(title) { ForEach(items, id: \.self) { Text($0).font(.callout) } }
        }
    }
}

struct ReferenceView: View {
    let kb: KnowledgeBase

    var body: some View {
        List {
            Section("Application types") {
                ForEach(kb.applicationTypes) { t in
                    HStack { Text(t.name); Spacer(); Text(t.mitigation.label).font(.caption).foregroundStyle(.secondary) }
                }
            }
            ForEach(kb.jurisdictions) { j in
                Section(j.name) {
                    Text("\(j.authority) · \(j.phone)")
                    if let url = URL(string: j.website) { Link("Website", destination: url) }
                    ForEach(j.notes, id: \.self) { Text($0).font(.caption) }
                    Text("Near water: \(j.nearWater)").font(.caption)
                    Text("Sensitive sites: \(j.sensitiveSite)").font(.caption)
                    if let n = j.neonicotinoid { Text("Neonicotinoids: \(n)").font(.caption) }
                }
            }
            Section("About") {
                Text("\(kb.meta.title) v\(kb.meta.version)")
                Text("Source: \(kb.meta.source)").font(.caption)
                Text("Content review status: \(kb.meta.reviewStatus)").font(.caption)
                Text(kb.meta.disclaimer).font(.caption)
            }
        }
        .navigationTitle("Reference")
    }
}
