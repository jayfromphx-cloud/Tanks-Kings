import Foundation
import Capacitor

/// Tanks & Kings iCloud save sync.
/// Mirrors the game's localStorage snapshot to NSUbiquitousKeyValueStore
/// so progress survives app deletion and syncs across the user's devices.
@objc(TKiCloudSync)
public class TKiCloudSync: CAPPlugin {

    private let store = NSUbiquitousKeyValueStore.default
    private let cloudKey = "tk_cloud_save_v1"

    @objc override public func load() {
        // Pick up remote changes while the app runs.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(storeDidChange(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store
        )
        store.synchronize()
    }

    @objc func storeDidChange(_ notification: Notification) {
        // Tell the webview a newer cloud save may be available.
        bridge?.triggerWindowJSEvent(eventName: "tkCloudSaveChanged")
    }

    /// Push a JSON string snapshot to iCloud.
    @objc func push(_ call: CAPPluginCall) {
        guard let snapshot = call.getString("snapshot") else {
            call.reject("Missing snapshot")
            return
        }
        store.set(snapshot, forKey: cloudKey)
        store.synchronize()
        call.resolve(["ok": true])
    }

    /// Pull the latest snapshot from iCloud. Resolves with {snapshot} or {snapshot: null}.
    @objc func pull(_ call: CAPPluginCall) {
        store.synchronize()
        let snapshot = store.string(forKey: cloudKey)
        call.resolve(["snapshot": snapshot as Any])
    }

    /// Last-modified timestamp bookkeeping so we can resolve conflicts (newest wins).
    @objc func pushWithTimestamp(_ call: CAPPluginCall) {
        guard let snapshot = call.getString("snapshot"),
              let ts = call.getDouble("timestamp") else {
            call.reject("Missing snapshot or timestamp")
            return
        }
        let existingTs = store.double(forKey: cloudKey + "_ts")
        if ts >= existingTs {
            store.set(snapshot, forKey: cloudKey)
            store.set(ts, forKey: cloudKey + "_ts")
            store.synchronize()
            call.resolve(["ok": true, "written": true])
        } else {
            call.resolve(["ok": true, "written": false, "reason": "remote-newer"])
        }
    }

    @objc func pullWithTimestamp(_ call: CAPPluginCall) {
        store.synchronize()
        let snapshot = store.string(forKey: cloudKey)
        let ts = store.double(forKey: cloudKey + "_ts")
        call.resolve(["snapshot": snapshot as Any, "timestamp": ts])
    }
}
