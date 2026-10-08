import Foundation

public struct KnowledgeBase: Decodable, Sendable {
    public let meta: Meta
    public let applicationTypes: [ApplicationType]
    public let hosts: [Host]
    public let categories: [Category]
    public let conditions: [Condition]
    public let jurisdictions: [Jurisdiction]

    public struct Meta: Decodable, Sendable {
        public let title: String
        public let version: String
        public let source: String
        public let reviewStatus: String
        public let disclaimer: String
    }

    public func condition(_ id: String) -> Condition? { conditions.first { $0.id == id } }
    public func applicationType(_ id: String) -> ApplicationType? { applicationTypes.first { $0.id == id } }
    public func host(_ id: String) -> Host? { hosts.first { $0.id == id } }
    public func category(_ id: String) -> Category? { categories.first { $0.id == id } }
    public func jurisdiction(_ code: JurisdictionCode) -> Jurisdiction? { jurisdictions.first { $0.id == code } }

    /// Conditions recorded for a host; generalist conditions (e.g. abiotic, SLF) follow the host-specific ones.
    public func conditions(forHost hostId: String) -> [Condition] {
        let specific = conditions.filter { $0.hostIds.contains(hostId) }
        let general = conditions.filter { $0.generalist && !$0.hostIds.contains(hostId) }
        return specific + general
    }

    public static func bundled() throws -> KnowledgeBase {
        guard let url = Bundle.module.url(forResource: "knowledge_base", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try JSONDecoder().decode(KnowledgeBase.self, from: Data(contentsOf: url))
    }
}

public enum JurisdictionCode: String, Codable, CaseIterable, Identifiable, Sendable {
    case VA, MD, DC
    public var id: String { rawValue }
}

public struct ApplicationType: Decodable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String

    public var mitigation: Mitigation {
        switch id {
        case "foliar", "dormantOil", "barkSpray", "basalBark", "soilDrench", "microInjection", "macroInjection":
            return .chemical
        case "pruning", "mechanical": return .mechanical
        case "diagnostic": return .diagnostic
        case "replacement": return .removal
        default: return .cultural
        }
    }
}

public enum Mitigation: String, CaseIterable, Sendable {
    case diagnostic, chemical, cultural, mechanical, removal

    public var label: String {
        switch self {
        case .diagnostic: return "Diagnosis & monitoring"
        case .chemical: return "Chemical"
        case .cultural: return "Cultural"
        case .mechanical: return "Mechanical / sanitation"
        case .removal: return "Removal / replacement"
        }
    }
}

public struct Host: Decodable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
}

public struct Category: Decodable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
}

public struct Condition: Decodable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let scientificName: String?
    public let category: String
    public let hostIds: [String]
    public let hostNote: String?
    public let generalist: Bool
    public let symptoms: [String]
    public let biology: [String]
    public let lookalikeIds: [String]
    public let activeMonths: [Int]
    public let peakNote: String?
    public let curable: Bool
    public let labConfirmation: Bool
    public let bloomSensitive: Bool
    public let maxCrownLossPercent: Int?
    public let cautionCrownLossPercent: Int?
    public let noTreatmentMonths: [Int]
    public let noTreatmentReason: String?
    public let treatments: [Treatment]
    public let regulatory: [RegulatoryNote]
    public let costShare: [CostShare]
    public let warnings: [String]
    public let sources: [String]
    public let reviewFlags: [String]

    enum CodingKeys: String, CodingKey {
        case id, name, scientificName, category, hostIds, hostNote, generalist, symptoms, biology, lookalikeIds,
             activeMonths, peakNote, curable, labConfirmation, bloomSensitive, maxCrownLossPercent,
             cautionCrownLossPercent, noTreatmentMonths, noTreatmentReason, treatments, regulatory, costShare,
             warnings, sources, reviewFlags
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        scientificName = try c.decodeIfPresent(String.self, forKey: .scientificName)
        category = try c.decode(String.self, forKey: .category)
        hostIds = try c.decode([String].self, forKey: .hostIds)
        hostNote = try c.decodeIfPresent(String.self, forKey: .hostNote)
        generalist = try c.decodeIfPresent(Bool.self, forKey: .generalist) ?? false
        symptoms = try c.decode([String].self, forKey: .symptoms)
        biology = try c.decodeIfPresent([String].self, forKey: .biology) ?? []
        lookalikeIds = try c.decodeIfPresent([String].self, forKey: .lookalikeIds) ?? []
        activeMonths = try c.decodeIfPresent([Int].self, forKey: .activeMonths) ?? []
        peakNote = try c.decodeIfPresent(String.self, forKey: .peakNote)
        curable = try c.decodeIfPresent(Bool.self, forKey: .curable) ?? true
        labConfirmation = try c.decodeIfPresent(Bool.self, forKey: .labConfirmation) ?? false
        bloomSensitive = try c.decodeIfPresent(Bool.self, forKey: .bloomSensitive) ?? false
        maxCrownLossPercent = try c.decodeIfPresent(Int.self, forKey: .maxCrownLossPercent)
        cautionCrownLossPercent = try c.decodeIfPresent(Int.self, forKey: .cautionCrownLossPercent)
        noTreatmentMonths = try c.decodeIfPresent([Int].self, forKey: .noTreatmentMonths) ?? []
        noTreatmentReason = try c.decodeIfPresent(String.self, forKey: .noTreatmentReason)
        treatments = try c.decode([Treatment].self, forKey: .treatments)
        regulatory = try c.decodeIfPresent([RegulatoryNote].self, forKey: .regulatory) ?? []
        costShare = try c.decodeIfPresent([CostShare].self, forKey: .costShare) ?? []
        warnings = try c.decodeIfPresent([String].self, forKey: .warnings) ?? []
        sources = try c.decodeIfPresent([String].self, forKey: .sources) ?? []
        reviewFlags = try c.decodeIfPresent([String].self, forKey: .reviewFlags) ?? []
    }
}

public struct Treatment: Decodable, Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let applicationType: String
    /// Months (1–12) in which the option is timed; empty means no seasonal restriction.
    public let months: [Int]
    public let frequency: String?
    public let protection: String?
    public let purpose: String
    public let notes: [String]
    public let suppressiveOnly: Bool
    public let requiresLicense: Bool

    enum CodingKeys: String, CodingKey {
        case id, title, applicationType, months, frequency, protection, purpose, notes, suppressiveOnly, requiresLicense
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        applicationType = try c.decode(String.self, forKey: .applicationType)
        months = try c.decodeIfPresent([Int].self, forKey: .months) ?? []
        frequency = try c.decodeIfPresent(String.self, forKey: .frequency)
        protection = try c.decodeIfPresent(String.self, forKey: .protection)
        purpose = try c.decode(String.self, forKey: .purpose)
        notes = try c.decodeIfPresent([String].self, forKey: .notes) ?? []
        suppressiveOnly = try c.decodeIfPresent(Bool.self, forKey: .suppressiveOnly) ?? false
        requiresLicense = try c.decodeIfPresent(Bool.self, forKey: .requiresLicense) ?? false
    }

    /// All free text that may name active ingredients, lowercased, for rule matching.
    var ingredientText: String { ([title] + notes).joined(separator: " ").lowercased() }
}

public struct RegulatoryNote: Decodable, Hashable, Sendable {
    public let jurisdictions: [JurisdictionCode]
    public let text: String
}

public struct CostShare: Decodable, Hashable, Sendable {
    public let jurisdiction: JurisdictionCode
    public let text: String
    public let minDBH: Double?
    public let publicOnly: Bool?
}

public struct Jurisdiction: Decodable, Identifiable, Hashable, Sendable {
    public let id: JurisdictionCode
    public let name: String
    public let authority: String
    public let phone: String
    public let website: String
    public let notes: [String]
    public let nearWater: String
    public let sensitiveSite: String
    public let neonicotinoid: String?
}

public enum Months {
    public static let names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    public static func name(_ m: Int) -> String { names[(m - 1 + 12) % 12] }

    /// Compact range text, e.g. [11,12,1,2] -> "Nov–Feb"; [3,4,5,9,10] -> "Mar–May, Sep–Oct".
    public static func describe(_ months: [Int]) -> String {
        let set = Set(months)
        guard !set.isEmpty else { return "Any time" }
        if set.count == 12 { return "Year-round" }
        // Start runs at a month whose predecessor is absent so wrap-around ranges stay together.
        var runs: [(Int, Int)] = []
        for m in 1...12 where set.contains(m) && !set.contains(m == 1 ? 12 : m - 1) {
            var end = m
            while set.contains(end % 12 + 1) { end = end % 12 + 1 }
            runs.append((m, end))
        }
        return runs.map { $0.0 == $0.1 ? name($0.0) : "\(name($0.0))–\(name($0.1))" }.joined(separator: ", ")
    }
}
