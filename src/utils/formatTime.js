'use strict';

/**
 * Quy đổi tổng số giây thành định dạng thời gian kiểu Minecraft:
 * Ví dụ: 12 giây, 5 phút 20 giây, 3 giờ 15 phút 10 giây, 2 ngày 4 giờ...
 */
function formatMinecraftTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0 giây';

  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  const parts = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0) parts.push(`${minutes} phút`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} giây`);

  return parts.join(' ');
}

module.exports = { formatMinecraftTime };
  
