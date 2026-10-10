import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var audioInterruptionObserver: NSObjectProtocol?

    /// Game audio must ignore the iPhone silent switch and survive
    /// backgrounding, phone calls, and Siri. WKWebView routes Web Audio
    /// through the shared AVAudioSession, so we pin it to `.playback` and
    /// re-assert it every time the app becomes active — iOS resets the
    /// session around interruptions, and a single set-at-launch does not
    /// survive them.
    private func configureAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("AVAudioSession setup failed: \(error)")
        }
    }

    private func observeAudioInterruptions() {
        guard audioInterruptionObserver == nil else { return }
        audioInterruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let info = note.userInfo,
                  let typeRaw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeRaw),
                  type == .ended else { return }
            // Call/Siri ended: take the session back so game audio resumes.
            self?.configureAudioSession()
        }
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Make game audio (Web Audio SFX + BGM) ignore the iPhone silent switch.
        configureAudioSession()
        observeAudioInterruptions()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // 2026-10-10: Notification Center / Control Center pull-down fires NO
        // web event, so suspend the shared Web Audio context from native here.
        if let vc = window?.rootViewController as? CAPBridgeViewController {
            vc.bridge?.webView?.evaluateJavaScript("try{if(typeof tkAudioLoseFocus==='function')tkAudioLoseFocus();}catch(e){}", completionHandler: nil)
        }
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Re-assert the playback category: iOS may have reset the audio
        // session while we were backgrounded or interrupted.
        configureAudioSession()
        // 2026-10-10: regain focus after pull-down / background — resume audio.
        if let vc = window?.rootViewController as? CAPBridgeViewController {
            vc.bridge?.webView?.evaluateJavaScript("try{if(typeof tkAudioRegainFocus==='function')tkAudioRegainFocus();}catch(e){}", completionHandler: nil)
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
        if let obs = audioInterruptionObserver {
            NotificationCenter.default.removeObserver(obs)
            audioInterruptionObserver = nil
        }
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
