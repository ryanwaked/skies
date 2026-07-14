// Skies — menu-bar controller for the restyled marimo notebook.
// Owns the server process; provides Open / Restart / Quit from the
// macOS status bar. Compiled with CLT swiftc; no external deps.
import AppKit
import Foundation

let PORT = 2719
let REPO = "/Users/rayanwaked/marimo"
let SERVER_URL = "http://127.0.0.1:\(PORT)"

final class AppDelegate: NSObject, NSApplicationDelegate {
  var statusItem: NSStatusItem!
  var statusLine: NSMenuItem!
  var server: Process?
  var quitting = false

  func applicationDidFinishLaunching(_ note: Notification) {
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    if let button = statusItem.button {
      // Template SF Symbol echoing the app icon's sun-over-horizon mark;
      // monochrome template adapts to light/dark menu bars automatically.
      // Fall back through related symbols on older systems, then to text.
      let symbol = ["sun.horizon.fill", "sun.horizon", "sun.max.fill"]
        .lazy
        .compactMap {
          NSImage(systemSymbolName: $0, accessibilityDescription: "Skies")
        }
        .first
      if let img = symbol {
        img.isTemplate = true
        button.image = img
      } else {
        button.title = "S"
      }
    }

    let menu = NSMenu()
    statusLine = NSMenuItem(title: "Starting…", action: nil, keyEquivalent: "")
    statusLine.isEnabled = false
    menu.addItem(statusLine)
    menu.addItem(.separator())
    menu.addItem(makeItem("Open Skies", #selector(openWindow), "o"))
    menu.addItem(makeItem("Restart Server", #selector(restartServer), "r"))
    menu.addItem(.separator())
    menu.addItem(makeItem("Quit Skies", #selector(quitApp), "q"))
    statusItem.menu = menu

    runUpdate { self.startServer(openWhenReady: true) }
  }

  /// Pull any new version of `main` and rebuild the frontend if needed, then
  /// continue. Delegated to `scripts/skies-update.sh`, which is a fast no-op
  /// when already up to date and never blocks startup on failure. Runs off the
  /// main thread; `done` is always called back on the main thread.
  private func runUpdate(_ done: @escaping () -> Void) {
    setStatus("Checking for updates…")
    DispatchQueue.global().async {
      let script = "\(REPO)/scripts/skies-update.sh"
      if FileManager.default.fileExists(atPath: script) {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/sh")
        p.arguments = [script]
        p.currentDirectoryURL = URL(fileURLWithPath: REPO)
        p.standardOutput = FileHandle.nullDevice
        p.standardError = FileHandle.nullDevice
        try? p.run()
        p.waitUntilExit()
      }
      DispatchQueue.main.async { done() }
    }
  }

  private func makeItem(_ title: String, _ sel: Selector, _ key: String) -> NSMenuItem {
    let item = NSMenuItem(title: title, action: sel, keyEquivalent: key)
    item.target = self
    return item
  }

  private func setStatus(_ text: String) {
    DispatchQueue.main.async { self.statusLine.title = text }
  }

  /// Synchronous "does anything answer on the port" check (1s budget).
  private func portOpen() -> Bool {
    guard let url = URL(string: SERVER_URL) else { return false }
    var request = URLRequest(url: url)
    request.timeoutInterval = 1
    let semaphore = DispatchSemaphore(value: 0)
    var ok = false
    URLSession.shared.dataTask(with: request) { _, response, _ in
      ok = response != nil
      semaphore.signal()
    }.resume()
    _ = semaphore.wait(timeout: .now() + 1.5)
    return ok
  }

  private func startServer(openWhenReady: Bool) {
    if portOpen() {
      // Adopt an already-running server (e.g. app relaunch).
      setStatus("Running on 127.0.0.1:\(PORT)")
      if openWhenReady { openWindow() }
      return
    }

    let process = Process()
    process.executableURL = URL(fileURLWithPath: "\(REPO)/.venv/bin/marimo")
    process.arguments = ["edit", "--headless", "--no-token", "--port", "\(PORT)"]
    process.currentDirectoryURL = URL(fileURLWithPath: REPO)
    process.standardOutput = FileHandle.nullDevice
    process.standardError = FileHandle.nullDevice
    process.terminationHandler = { [weak self] _ in
      guard let self, !self.quitting else { return }
      self.setStatus("Server stopped")
    }

    do {
      try process.run()
      server = process
      setStatus("Starting…")
    } catch {
      setStatus("Failed to start server")
      return
    }

    DispatchQueue.global().async {
      for _ in 0..<120 {
        if self.portOpen() {
          self.setStatus("Running on 127.0.0.1:\(PORT)")
          if openWhenReady {
            DispatchQueue.main.async { self.openWindow() }
          }
          return
        }
        Thread.sleep(forTimeInterval: 0.5)
      }
      self.setStatus("Server did not start")
    }
  }

  private func stopServer(_ done: @escaping () -> Void) {
    DispatchQueue.global().async {
      if let child = self.server, child.isRunning {
        child.terminate()
        child.waitUntilExit()
      } else {
        // Adopted/stray server: stop it by command-line pattern.
        let kill = Process()
        kill.executableURL = URL(fileURLWithPath: "/usr/bin/pkill")
        kill.arguments = ["-f", "marimo edit --headless --no-token --port \(PORT)"]
        try? kill.run()
        kill.waitUntilExit()
        Thread.sleep(forTimeInterval: 0.8)
      }
      self.server = nil
      done()
    }
  }

  @objc func openWindow() {
    let open = Process()
    open.executableURL = URL(fileURLWithPath: "/usr/bin/open")
    if FileManager.default.fileExists(atPath: "/Applications/Google Chrome.app") {
      open.arguments = [
        "-na", "Google Chrome", "--args",
        "--app=\(SERVER_URL)", "--window-size=1500,980",
      ]
    } else {
      open.arguments = [SERVER_URL]
    }
    try? open.run()
  }

  @objc func restartServer() {
    setStatus("Restarting…")
    stopServer { self.runUpdate { self.startServer(openWhenReady: false) } }
  }

  @objc func quitApp() {
    quitting = true
    setStatus("Stopping…")
    stopServer { DispatchQueue.main.async { NSApp.terminate(nil) } }
  }

  func applicationShouldHandleReopen(
    _ sender: NSApplication, hasVisibleWindows: Bool
  ) -> Bool {
    openWindow()
    return false
  }

  func applicationWillTerminate(_ notification: Notification) {
    quitting = true
    if let child = server, child.isRunning { child.terminate() }
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
