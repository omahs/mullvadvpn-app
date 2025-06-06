use super::TunConfig;
use std::{io, net::IpAddr, ops::Deref};
use tun07 as tun;
use tun07::{AbstractDevice, AsyncDevice, Configuration};

/// Errors that can occur while setting up a tunnel device.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// Failed to set IP address
    #[error("Failed to set IPv4 address")]
    SetIpv4(#[source] tun::Error),

    /// Failed to set IP address
    #[error("Failed to set IPv6 address")]
    SetIpv6(#[source] io::Error),

    /// Unable to open a tunnel device
    #[error("Unable to open a tunnel device")]
    CreateDevice(#[source] tun::Error),

    /// Failed to enable/disable link device
    #[error("Failed to enable/disable link device")]
    ToggleDevice(#[source] tun::Error),

    /// Failed to get device name
    #[error("Failed to get tunnel device name")]
    GetDeviceName(#[source] tun::Error),

    /// IO error
    #[error("IO error")]
    Io(#[from] io::Error),
}

/// Factory of tunnel devices on Unix systems.
pub struct WindowsTunProvider {
    config: TunConfig,
}

impl WindowsTunProvider {
    pub const fn new(config: TunConfig) -> Self {
        WindowsTunProvider { config }
    }

    /// Get the current tunnel config. Note that the tunnel must be recreated for any changes to
    /// take effect.
    pub fn config_mut(&mut self) -> &mut TunConfig {
        &mut self.config
    }

    /// Open a tunnel using the current tunnel config.
    pub fn open_tun(&mut self) -> Result<WindowsTun, Error> {
        let mut tunnel_device = {
            #[allow(unused_mut)]
            let mut builder = TunnelDeviceBuilder::default();
            #[cfg(target_os = "linux")]
            if let Some(ref name) = self.config.name {
                builder.name(name);
            }
            builder.create()?
        };

        for ip in self.config.addresses.iter() {
            tunnel_device.set_ip(*ip)?;
        }

        tunnel_device.set_up(true)?;

        Ok(WindowsTun(tunnel_device))
    }
}

/// Generic tunnel device.
///
/// Contains the file descriptor representing the device.
pub struct WindowsTun(TunnelDevice);

impl WindowsTun {
    /// Retrieve the tunnel interface name.
    pub fn interface_name(&self) -> Result<String, Error> {
        self.get_name()
    }

    pub fn into_inner(self) -> AsyncDevice {
        AsyncDevice::new(self.0.dev).unwrap()
    }
}

impl Deref for WindowsTun {
    type Target = TunnelDevice;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// A tunnel device
pub struct TunnelDevice {
    dev: tun::Device,
}

/// A tunnel device builder.
///
/// Call [`Self::create`] to create [`TunnelDevice`] from the config.
pub struct TunnelDeviceBuilder {
    config: Configuration,
}

impl TunnelDeviceBuilder {
    /// Create a [`TunnelDevice`] from this builder.
    pub fn create(self) -> Result<TunnelDevice, Error> {
        let dev = tun::create(&self.config).map_err(Error::CreateDevice)?;
        Ok(TunnelDevice { dev })
    }
}

impl Default for TunnelDeviceBuilder {
    fn default() -> Self {
        let config = Configuration::default();
        Self { config }
    }
}

impl TunnelDevice {
    fn set_ip(&mut self, ip: IpAddr) -> Result<(), Error> {
        match ip {
            IpAddr::V4(ipv4) => self.dev.set_address(ipv4.into()).map_err(Error::SetIpv4),
            IpAddr::V6(_ipv6) => {
                // TODO
                todo!("ipv6 not implemented");
            }
        }
    }

    fn set_up(&mut self, up: bool) -> Result<(), Error> {
        self.dev.enabled(up).map_err(Error::ToggleDevice)
    }

    fn get_name(&self) -> Result<String, Error> {
        self.dev.tun_name().map_err(Error::GetDeviceName)
    }
}
