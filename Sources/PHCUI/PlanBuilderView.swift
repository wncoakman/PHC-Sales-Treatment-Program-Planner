import SwiftUI
import PHCKit

struct PlanBuilderView: View {
    let kb: KnowledgeBase
    @Bindable var plan: PlanModel

    var body: some View {
        Form {
            Section("Site") {
                TextField("Site / client / tree ID (optional)", text: $plan.siteLabel)
                Picker("Jurisdiction", selection: $plan.site.jurisdiction) {
                    ForEach(JurisdictionCode.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                Picker("Planned month", selection: $plan.site.month) {
                    ForEach(1...12, id: \.self) { Text(Months.name($0)).tag($0) }
                }
                Picker("Host", selection: $plan.hostId) {
                    Text("Any").tag(String?.none)
                    ForEach(kb.hosts) { Text($0.name).tag(Optional($0.id)) }
                }
                OptionalNumberField(title: "DBH (in.)", value: $plan.site.dbhInches)
                OptionalPercentField(title: "Crown loss (%)", value: $plan.site.crownLossPercent)
                Toggle("Near water / Bay buffer", isOn: $plan.site.nearWater)
                Toggle("School, daycare, or park", isOn: $plan.site.sensitiveSite)
                Toggle("Public property", isOn: $plan.site.publicProperty)
                Toggle("Host in bloom", isOn: $plan.site.inBloom)
            }

            Section("Problems (\(plan.conditionIds.count))") {
                ForEach(plan.conditionIds, id: \.self) { id in
                    if let c = kb.condition(id) { Text(c.name) }
                }
                .onDelete { idx in
                    for i in idx { if let c = kb.condition(plan.conditionIds[i]) { plan.toggleCondition(c) } }
                }
                NavigationLink("Add / remove problems") {
                    ConditionPickerView(kb: kb, plan: plan)
                }
            }

            Section {
                NavigationLink("Build treatment framework") {
                    PlanResultView(kb: kb, plan: plan)
                }
                .disabled(plan.conditionIds.isEmpty)
                Button("Clear plan", role: .destructive) { plan.reset() }
            }
        }
        .navigationTitle("Treatment Plan")
    }
}

struct ConditionPickerView: View {
    let kb: KnowledgeBase
    @Bindable var plan: PlanModel
    @State private var query = ""

    var body: some View {
        let base = plan.hostId.map { kb.conditions(forHost: $0) } ?? kb.conditions
        let list = query.isEmpty ? base : base.filter { $0.matches(query) }
        List(list) { c in
            Button {
                plan.toggleCondition(c)
            } label: {
                HStack {
                    VStack(alignment: .leading) {
                        Text(c.name)
                        Text(kb.category(c.category)?.name ?? c.category).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if plan.conditionIds.contains(c.id) { Image(systemName: "checkmark") }
                }
            }
            .foregroundStyle(.primary)
        }
        .searchable(text: $query, prompt: "Name or symptom")
        .navigationTitle(plan.hostId.flatMap { kb.host($0)?.name } ?? "All problems")
    }
}

struct OptionalNumberField: View {
    let title: String
    @Binding var value: Double?
    @State private var text = ""

    var body: some View {
        TextField(title, text: $text)
            .decimalKeyboard()
            .onAppear { text = value.map { String($0) } ?? "" }
            .onChange(of: text) { value = Double($1) }
    }
}

struct OptionalPercentField: View {
    let title: String
    @Binding var value: Int?
    @State private var text = ""

    var body: some View {
        TextField(title, text: $text)
            .decimalKeyboard()
            .onAppear { text = value.map { String($0) } ?? "" }
            .onChange(of: text) { value = Int($1).map { min(max($0, 0), 100) } }
    }
}

extension View {
    func decimalKeyboard() -> some View {
        #if os(iOS)
        keyboardType(.decimalPad)
        #else
        self
        #endif
    }
}

extension Condition {
    func matches(_ q: String) -> Bool {
        ([name, scientificName ?? ""] + symptoms).contains { $0.localizedCaseInsensitiveContains(q) }
    }
}
