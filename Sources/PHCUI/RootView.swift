import SwiftUI
import PHCKit

public struct RootView: View {
    @State private var kb: KnowledgeBase?
    @State private var loadError: String?
    @State private var plan = PlanModel()

    public init() {}

    public var body: some View {
        Group {
            if let kb {
                TabView {
                    NavigationStack { PlanBuilderView(kb: kb, plan: plan) }
                        .tabItem { Label("Plan", systemImage: "list.bullet.clipboard") }
                    NavigationStack { LibraryView(kb: kb) }
                        .tabItem { Label("Library", systemImage: "leaf") }
                    NavigationStack { ReferenceView(kb: kb) }
                        .tabItem { Label("Reference", systemImage: "book") }
                }
            } else if let loadError {
                Text("Could not load knowledge base: \(loadError)")
            } else {
                ProgressView()
            }
        }
        .task {
            do { kb = try KnowledgeBase.bundled() } catch { loadError = error.localizedDescription }
        }
    }
}

@Observable
final class PlanModel {
    var site = SiteContext(month: Calendar.current.component(.month, from: Date()))
    var siteLabel = ""
    var hostId: String?
    var conditionIds: [String] = []
    /// Treatment option ids included in the plan.
    var selected: Set<String> = []

    func toggleCondition(_ c: Condition) {
        if let i = conditionIds.firstIndex(of: c.id) {
            conditionIds.remove(at: i)
            selected.subtract(c.treatments.map(\.id))
        } else {
            conditionIds.append(c.id)
            selected.formUnion(c.treatments.map(\.id))
        }
    }

    func reset() {
        conditionIds = []
        selected = []
        siteLabel = ""
        hostId = nil
        site = SiteContext(jurisdiction: site.jurisdiction, month: site.month)
    }
}
