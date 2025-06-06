//
//  MockTunnel.swift
//  MullvadVPNTests
//
//  Created by Andrew Bulhak on 2024-02-05.
//  Copyright © 2025 Mullvad VPN AB. All rights reserved.
//

import Foundation
import MullvadTypes
import NetworkExtension

class MockTunnel: TunnelProtocol, @unchecked Sendable {
    typealias TunnelManagerProtocol = SimulatorTunnelProviderManager

    var status: NEVPNStatus

    var isOnDemandEnabled: Bool

    var startDate: Date?

    var backgroundTaskProvider: BackgroundTaskProviding

    required init(tunnelProvider: TunnelManagerProtocol, backgroundTaskProvider: BackgroundTaskProviding) {
        status = .disconnected
        isOnDemandEnabled = false
        startDate = nil
        self.backgroundTaskProvider = backgroundTaskProvider
    }

    // Observers are currently unimplemented
    func addObserver(_ observer: TunnelStatusObserver) {}

    func removeObserver(_ observer: TunnelStatusObserver) {}

    func addBlockObserver(
        queue: DispatchQueue?,
        handler: @escaping (any TunnelProtocol, NEVPNStatus) -> Void
    ) -> TunnelStatusBlockObserver {
        fatalError("MockTunnel.addBlockObserver Not implemented")
    }

    func logFormat() -> String {
        ""
    }

    func saveToPreferences(_ completion: @escaping (Error?) -> Void) {
        completion(nil)
    }

    func removeFromPreferences(completion: @escaping (Error?) -> Void) {
        completion(nil)
    }

    func setConfiguration(_ configuration: TunnelConfiguration) {}

    func start(options: [String: NSObject]?) throws {
        startDate = Date()
    }

    func stop() {}

    func sendProviderMessage(_ messageData: Data, responseHandler: ((Data?) -> Void)?) throws {}
}
