//
//  PersistentAccessMethod+ViewModel.swift
//  MullvadVPN
//
//  Created by pronebird on 17/11/2023.
//  Copyright © 2025 Mullvad VPN AB. All rights reserved.
//

import Foundation
import MullvadSettings
import MullvadTypes

extension PersistentAccessMethod {
    /// Convert persistent model into view model.
    /// - Returns: an instance of ``AccessMethodViewModel``.
    func toViewModel() -> AccessMethodViewModel {
        AccessMethodViewModel(
            id: id,
            name: name,
            method: kind,
            isEnabled: isEnabled,
            socks: proxyConfiguration.socksViewModel,
            shadowsocks: proxyConfiguration.shadowsocksViewModel
        )
    }
}
