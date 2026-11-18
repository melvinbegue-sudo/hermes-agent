import Capacitor
import WidgetKit

// Contrôleur principal : enregistre les plugins locaux à l'app (Capacitor 8, plugin "app-local").
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(MBWidgetPlugin())
    }
}

// window.Capacitor.Plugins.MBWidget.update({kcal, kcalGoal, prot, protGoal, steps, stepsGoal, date})
// -> écrit le JSON dans l'App Group partagé avec le widget "Anneaux du jour" puis recharge les widgets.
@objc(MBWidgetPlugin)
public class MBWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MBWidgetPlugin"
    public let jsName = "MBWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.fr.mbnutrition.app"

    @objc func update(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
            call.reject("App Group \(Self.appGroup) indisponible (capability manquante)")
            return
        }
        var rings: [String: Any] = ["date": call.getString("date") ?? ""]
        for k in ["kcal", "kcalGoal", "prot", "protGoal", "steps", "stepsGoal"] {
            rings[k] = max(0, call.getInt(k) ?? 0)
        }
        do {
            defaults.set(try JSONSerialization.data(withJSONObject: rings), forKey: "rings")
            WidgetCenter.shared.reloadAllTimelines()
            call.resolve()
        } catch {
            call.reject("rings JSON", nil, error)
        }
    }
}
