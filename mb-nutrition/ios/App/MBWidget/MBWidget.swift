import SwiftUI
import WidgetKit

// Widget "Anneaux du jour" : lit le JSON "rings" écrit par l'app (MBWidgetPlugin) dans l'App Group.

struct Rings: Decodable {
    var kcal = 0, kcalGoal = 0, prot = 0, protGoal = 0, steps = 0, stepsGoal = 0
    var date = ""

    static func load() -> Rings? {
        guard let data = UserDefaults(suiteName: "group.fr.mbnutrition.app")?.data(forKey: "rings") else { return nil }
        return try? JSONDecoder().decode(Rings.self, from: data)
    }
}

func isoDay(_ d: Date) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.calendar = Calendar(identifier: .gregorian)
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: d)
}

struct RingsEntry: TimelineEntry {
    let date: Date
    let rings: Rings?
    // Données d'un autre jour (app pas ouverte aujourd'hui) -> "—"
    var today: Rings? { rings?.date == isoDay(date) ? rings : nil }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> RingsEntry {
        RingsEntry(date: Date(), rings: Rings(kcal: 1450, kcalGoal: 2100, prot: 95, protGoal: 140, steps: 6200, stepsGoal: 8000, date: isoDay(Date())))
    }
    func getSnapshot(in context: Context, completion: @escaping (RingsEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : RingsEntry(date: Date(), rings: Rings.load()))
    }
    // Entrée maintenant + entrée à minuit (passe à "—" si l'app n'a pas encore écrit le nouveau jour).
    func getTimeline(in context: Context, completion: @escaping (Timeline<RingsEntry>) -> Void) {
        let now = Date(), r = Rings.load()
        let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86400))
        completion(Timeline(entries: [RingsEntry(date: now, rings: r), RingsEntry(date: midnight, rings: r)], policy: .atEnd))
    }
}

// Couleurs de l'app (www/app.css) : clair / sombre.
func dyn(_ light: UInt32, _ dark: UInt32) -> Color {
    func c(_ h: UInt32) -> UIColor {
        UIColor(red: CGFloat((h >> 16) & 255) / 255, green: CGFloat((h >> 8) & 255) / 255, blue: CGFloat(h & 255) / 255, alpha: 1)
    }
    return Color(UIColor { $0.userInterfaceStyle == .dark ? c(dark) : c(light) })
}
let kcalColor = dyn(0xFF5A1F, 0xFF6A33), protColor = dyn(0x2F7BFF, 0x4C8DFF), stepsColor = dyn(0x20C463, 0x30D46F)
let kcalText = dyn(0xCC3600, 0xFF6A33), protText = dyn(0x1660E0, 0x4C8DFF), stepsText = dyn(0x157E40, 0x30D46F)
let cardColor = dyn(0xFFFFFF, 0x17171C), trackOpacity = 0.18

struct Ring: View {
    let value: Int, goal: Int, color: Color, width: CGFloat
    var body: some View {
        let p = goal > 0 ? min(Double(value) / Double(goal), 1) : 0
        ZStack {
            Circle().stroke(color.opacity(trackOpacity), lineWidth: width)
            Circle().trim(from: 0, to: p)
                .stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .padding(width / 2)
    }
}

struct RingsStack: View {
    let r: Rings?
    var body: some View {
        GeometryReader { g in
            let s = min(g.size.width, g.size.height), w = s * 0.12, gap = w * 1.25
            ZStack {
                Ring(value: r?.kcal ?? 0, goal: r?.kcalGoal ?? 0, color: kcalColor, width: w)
                Ring(value: r?.prot ?? 0, goal: r?.protGoal ?? 0, color: protColor, width: w).padding(gap)
                Ring(value: r?.steps ?? 0, goal: r?.stepsGoal ?? 0, color: stepsColor, width: w).padding(gap * 2)
            }
            .frame(width: s, height: s)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

func fmt(_ v: Int) -> String { v.formatted(.number.locale(Locale(identifier: "fr_FR"))) }

struct Row: View {
    let label: String, value: String, goal: String, color: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label).font(.caption2.weight(.semibold)).foregroundColor(color)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value).font(.system(.subheadline, design: .rounded).weight(.bold)).monospacedDigit()
                Text(goal).font(.caption2).foregroundColor(.secondary).monospacedDigit()
            }
        }
        .lineLimit(1).minimumScaleFactor(0.7)
    }
}

struct RingsView: View {
    @Environment(\.widgetFamily) var family
    let entry: RingsEntry

    var body: some View {
        let r = entry.today
        let v = { (x: Int) in r == nil ? "—" : fmt(x) }
        let g = { (x: Int) in r == nil || x == 0 ? "" : "/ " + fmt(x) }
        Group {
            if family == .systemMedium {
                HStack(spacing: 14) {
                    RingsStack(r: r)
                    VStack(alignment: .leading, spacing: 6) {
                        Row(label: "Calories", value: v(r?.kcal ?? 0), goal: g(r?.kcalGoal ?? 0), color: kcalText)
                        Row(label: "Protéines", value: r == nil ? "—" : v(r!.prot) + " g", goal: g(r?.protGoal ?? 0), color: protText)
                        Row(label: "Pas", value: v(r?.steps ?? 0), goal: g(r?.stepsGoal ?? 0), color: stepsText)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                ZStack {
                    RingsStack(r: r)
                    VStack(spacing: 0) {
                        Text(v(r?.kcal ?? 0)).font(.system(.caption, design: .rounded).weight(.bold)).monospacedDigit()
                        Text("kcal").font(.system(size: 9)).foregroundColor(.secondary)
                    }
                    .minimumScaleFactor(0.6)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(r == nil
            ? "Anneaux du jour : pas encore de données aujourd'hui"
            : "Anneaux du jour : \(fmt(r!.kcal)) sur \(fmt(r!.kcalGoal)) kilocalories, \(fmt(r!.prot)) sur \(fmt(r!.protGoal)) grammes de protéines, \(fmt(r!.steps)) sur \(fmt(r!.stepsGoal)) pas")
        .widgetBackground(cardColor)
    }
}

extension View {
    // iOS 17+ exige containerBackground ; iOS 15-16 : fond classique.
    @ViewBuilder func widgetBackground(_ c: Color) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(c, for: .widget)
        } else {
            padding().background(c)
        }
    }
}

@main
struct MBWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MBWidgetRings", provider: Provider()) { RingsView(entry: $0) }
            .configurationDisplayName("Anneaux du jour")
            .description("Calories, protéines et pas du jour.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
