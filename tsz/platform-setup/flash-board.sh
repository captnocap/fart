#!/bin/bash
set -euo pipefail

# Flash OS images to SD cards for ARM boards
# Run on your Linux host machine with SD card inserted

IMAGES_DIR="$HOME/vm/board-images"
mkdir -p "$IMAGES_DIR"

cat <<'BANNER'
============================================
 ARM Board SD Card Flasher
 Pi 5 | Pi 4B | Orange Pi 5 | Le Potato
============================================
BANNER

echo ""
echo "Which board are you flashing?"
echo "  1) Raspberry Pi 5"
echo "  2) Raspberry Pi 4B"
echo "  3) Orange Pi 5"
echo "  4) Libre Computer Le Potato"
echo ""
read -p "Choice [1-4]: " BOARD

case $BOARD in
    1|2)
        IMAGE_NAME="raspios-bookworm-arm64-lite.img"
        IMAGE_URL="https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2025-05-13/2025-05-13-raspios-bookworm-arm64-lite.img.xz"
        COMPRESSED=xz
        if [ "$BOARD" = "1" ]; then
            BOARD_NAME="Raspberry Pi 5"
        else
            BOARD_NAME="Raspberry Pi 4B"
        fi
        ;;
    3)
        BOARD_NAME="Orange Pi 5"
        IMAGE_NAME="orangepi5-armbian.img"
        IMAGE_URL="https://dl.armbian.com/orangepi5/Bookworm_current"
        COMPRESSED=xz
        ;;
    4)
        BOARD_NAME="Le Potato"
        IMAGE_NAME="lepotato-armbian.img"
        IMAGE_URL="https://dl.armbian.com/lepotato/Bookworm_current"
        COMPRESSED=xz
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "Board: $BOARD_NAME"
echo ""

# Download image if not cached
ARCHIVE="$IMAGES_DIR/${IMAGE_NAME}.xz"
IMGFILE="$IMAGES_DIR/${IMAGE_NAME}"

if [ -f "$IMGFILE" ]; then
    echo "Image already downloaded: $IMGFILE"
elif [ -f "$ARCHIVE" ]; then
    echo "Archive found, decompressing..."
    xz -dk "$ARCHIVE"
else
    echo "Downloading image..."
    curl -L -o "$ARCHIVE" "$IMAGE_URL"
    echo "Decompressing..."
    xz -dk "$ARCHIVE"
fi

echo ""
echo "Image ready: $IMGFILE"
echo ""

# Show available disks
echo "============================================"
echo " Available disks (DO NOT pick your main drive!):"
echo "============================================"
lsblk -d -o NAME,SIZE,MODEL,TRAN | grep -v "loop"
echo ""

read -p "Enter SD card device (e.g. sdb, mmcblk0): " SDCARD
SDCARD="/dev/$SDCARD"

# Safety check
if [ "$SDCARD" = "/dev/sda" ] || [ "$SDCARD" = "/dev/nvme0n1" ]; then
    echo "REFUSED — that looks like your main drive. Aborting."
    exit 1
fi

if ! [ -b "$SDCARD" ]; then
    echo "ERROR: $SDCARD is not a block device"
    exit 1
fi

SIZE=$(lsblk -b -d -n -o SIZE "$SDCARD" 2>/dev/null || echo 0)
SIZE_GB=$((SIZE / 1073741824))
echo ""
echo "Target: $SDCARD (${SIZE_GB}GB)"
echo "Board:  $BOARD_NAME"
echo ""
echo "THIS WILL ERASE ALL DATA ON $SDCARD"
read -p "Type YES to continue: " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
    echo "Aborted."
    exit 1
fi

# Unmount any partitions
echo "Unmounting partitions..."
umount ${SDCARD}* 2>/dev/null || true

# Flash
echo "Flashing $BOARD_NAME image to $SDCARD..."
echo "(This takes a few minutes)"
sudo dd if="$IMGFILE" of="$SDCARD" bs=4M status=progress conv=fsync

echo ""
echo "Flashed successfully!"
echo ""

# For Raspberry Pi: enable SSH and set up headless config
if [ "$BOARD" = "1" ] || [ "$BOARD" = "2" ]; then
    echo "Configuring headless access for Raspberry Pi..."
    sleep 2

    # Re-read partition table
    sudo partprobe "$SDCARD" 2>/dev/null || true
    sleep 2

    # Mount boot partition
    BOOT_PART="${SDCARD}1"
    if [[ "$SDCARD" == *"mmcblk"* ]]; then
        BOOT_PART="${SDCARD}p1"
    fi

    MOUNT_DIR=$(mktemp -d)
    sudo mount "$BOOT_PART" "$MOUNT_DIR"

    # Enable SSH
    sudo touch "$MOUNT_DIR/ssh"

    # Set default user (pi/raspberry) — you'll change this on first login
    echo 'pi:$6$rBoByrWRKMY1EHFy$GtIxPH0h/4enrSKG5fH0sGLQLnMFKS3LGyQmDNGGMm0bGkGMKWVpOJJBAZjgZMt3.hDJOAGkXtPEc3YABFhKJ0' | sudo tee "$MOUNT_DIR/userconf.txt" > /dev/null

    # WiFi config (optional — edit SSID/password if needed)
    # Uncomment and edit these lines if you want WiFi:
    # cat <<'WIFI' | sudo tee "$MOUNT_DIR/wpa_supplicant.conf"
    # country=US
    # ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
    # update_config=1
    # network={
    #     ssid="YOUR_WIFI_SSID"
    #     psk="YOUR_WIFI_PASSWORD"
    # }
    # WIFI

    sudo umount "$MOUNT_DIR"
    rmdir "$MOUNT_DIR"
    echo "SSH enabled. Default login: pi / raspberry"
fi

echo ""
echo "============================================"
echo " Done! Insert SD card into $BOARD_NAME"
echo " After boot, copy arm-setup.sh to it and run"
echo "============================================"
