//
//  State+Extensions.swift
//  PacketTunnelCore
//
//  Created by pronebird on 08/09/2023.
//  Copyright © 2025 Mullvad VPN AB. All rights reserved.
//

import Foundation
import MullvadTypes
import WireGuardKitTypes

extension State {
    /// Target state the actor should transition into upon request to either start (connect) or reconnect.
    enum TargetStateForReconnect {
        case reconnecting, connecting
    }

    /// Returns the target state to which the actor state should transition when requested to reconnect.
    /// It returns `nil` when reconnection is not supported such as when already `.disconnecting` or `.disconnected` states.
    var targetStateForReconnect: TargetStateForReconnect? {
        switch self {
        case .initial:
            return .connecting

        case .connecting, .negotiatingEphemeralPeer:
            return .connecting

        case .connected, .reconnecting:
            return .reconnecting

        case let .error(blockedState):
            switch blockedState.priorState {
            case .initial, .connecting:
                return .connecting
            case .connected, .reconnecting:
                return .reconnecting
            }

        case .disconnecting, .disconnected:
            return nil
        }
    }

    // MARK: - Logging

    func logFormat() -> String {
        switch self {
        case let .connecting(connState), let .connected(connState), let .reconnecting(connState):
            """
            \(name) to \(connState.selectedRelays.entry.flatMap { "entry location: \($0.hostname) " } ?? ""),\
            exit location: \(connState.selectedRelays.exit.hostname), \
            key: \(connState.keyPolicy.logFormat()), \
            net: \(connState.networkReachability), \
            attempt: \(connState.connectionAttemptCount)
            """

        case let .error(blockedState):
            "\(name): \(blockedState.reason)"

        case .initial, .disconnecting, .disconnected, .negotiatingEphemeralPeer:
            name
        }
    }

    var name: String {
        switch self {
        case let .negotiatingEphemeralPeer(connectionData, _):
            switch (connectionData.isPostQuantum, connectionData.isDaitaEnabled) {
            case (true, true):
                "Negotiating Post Quantum Key with Daita"
            case (true, false):
                "Negotiating Post Quantum Key"
            case (false, true):
                "Negotiating Daita peer without Post Quantum Key"
            case (false, false):
                "Negotiating ephemeral peer without Post Quantum Key or Daita -- Multihop exit relay probably"
            }
        case .connected:
            "Connected"
        case .connecting:
            "Connecting"
        case .reconnecting:
            "Reconnecting"
        case .disconnecting:
            "Disconnecting"
        case .disconnected:
            "Disconnected"
        case .initial:
            "Initial"
        case .error:
            "Error"
        }
    }

    var connectionData: State.ConnectionData? {
        switch self {
        case
            let .connecting(connState),
            let .connected(connState),
            let .reconnecting(connState),
            let .negotiatingEphemeralPeer(connState, _),
            let .disconnecting(connState): connState
        default: nil
        }
    }

    var blockedData: State.BlockingData? {
        switch self {
        case let .error(blockedState): blockedState
        default: nil
        }
    }

    var associatedData: StateAssociatedData? {
        self.connectionData ?? self.blockedData
    }

    var keyPolicy: KeyPolicy? {
        associatedData?.keyPolicy
    }

    /// Return a copy of this state with the associated value (if appropriate) replaced with a new value.
    /// If the value does not apply, this just returns the state as is, ignoring it.

    internal func replacingConnectionData(with newValue: State.ConnectionData) -> State {
        switch self {
        case .connecting: .connecting(newValue)
        case .connected: .connected(newValue)
        case .reconnecting: .reconnecting(newValue)
        case .disconnecting: .disconnecting(newValue)
        case let .negotiatingEphemeralPeer(_, privateKey): .negotiatingEphemeralPeer(newValue, privateKey)
        default: self
        }
    }

    /// Apply a mutating function to the connection/error state's associated data if this state has one,
    /// and replace its value. If not, this is a no-op.
    /// - parameter modifier: A function that takes an `inout ConnectionOrBlockedState` and modifies it
    mutating func mutateAssociatedData(_ modifier: (inout StateAssociatedData) -> Void) {
        switch self {
        case let .connecting(connState),
             let .connected(connState),
             let .reconnecting(connState),
             let .negotiatingEphemeralPeer(connState, _),
             let .disconnecting(connState):
            var associatedData: StateAssociatedData = connState
            modifier(&associatedData)
            // swiftlint:disable:next force_cast
            self = self.replacingConnectionData(with: associatedData as! ConnectionData)

        case let .error(blockedState):
            var associatedData: StateAssociatedData = blockedState
            modifier(&associatedData)
            // swiftlint:disable:next force_cast
            self = .error(associatedData as! BlockingData)

        default:
            break
        }
    }

    /// Apply a mutating function to the state's key policy
    /// - parameter modifier: A function that takes an `inout KeyPolicy` and modifies it
    mutating func mutateKeyPolicy(_ modifier: (inout KeyPolicy) -> Void) {
        self.mutateAssociatedData { modifier(&$0.keyPolicy) }
    }
}

extension State.KeyPolicy {
    func logFormat() -> String {
        switch self {
        case .useCurrent:
            return "current"
        case .usePrior:
            return "prior"
        }
    }
}

extension State.KeyPolicy: Equatable {
    static func == (lhs: State.KeyPolicy, rhs: State.KeyPolicy) -> Bool {
        switch (lhs, rhs) {
        case (.useCurrent, .useCurrent): true
        case let (.usePrior(priorA, _), .usePrior(priorB, _)): priorA == priorB
        default: false
        }
    }
}

extension BlockedStateReason {
    /**
     Returns true if the tunnel should attempt to restart periodically to recover from error that does not require explicit restart to be initiated by user.

     Common scenarios when tunnel will attempt to restart itself periodically:

     - Keychain and filesystem are locked on boot until user unlocks device in the very first time.
     - App update that requires settings schema migration. Packet tunnel will be automatically restarted after update but it would not be able to read settings until
       user opens the app which performs migration.
     - Packet tunnel will be automatically restarted when there is a tunnel adapter error.
     */
    var shouldRestartAutomatically: Bool {
        switch self {
        case .deviceLocked, .tunnelAdapter:
            return true
        case .noRelaysSatisfyingConstraints, .noRelaysSatisfyingFilterConstraints,
             .multihopEntryEqualsExit, .noRelaysSatisfyingObfuscationSettings,
             .noRelaysSatisfyingDaitaConstraints, .readSettings, .invalidAccount, .accountExpired, .deviceRevoked,
             .unknown, .deviceLoggedOut, .outdatedSchema, .invalidRelayPublicKey,
             .noRelaysSatisfyingPortConstraints:
            return false
        }
    }
}

extension State.BlockingData: Equatable {
    static func == (lhs: State.BlockingData, rhs: State.BlockingData) -> Bool {
        lhs.reason == rhs.reason
            && lhs.relayConstraints == rhs.relayConstraints
            && lhs.currentKey == rhs.currentKey
            && lhs.keyPolicy == rhs.keyPolicy
            && lhs.networkReachability == rhs.networkReachability
            && lhs.lastKeyRotation == rhs.lastKeyRotation
            && lhs.priorState == rhs.priorState
    }
}
