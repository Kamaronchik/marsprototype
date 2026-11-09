// Translation key of the greeting for this hour of the day.
export const greetingKey = (hour = new Date().getHours()) => {
  if (hour < 5) return 'dashboard.greetingNight';
  if (hour < 12) return 'dashboard.greetingMorning';
  if (hour < 18) return 'dashboard.greetingAfternoon';
  return 'dashboard.greetingEvening';
};

export const firstNameOf = (user) => (user?.fullName || user?.username || '').split(' ')[0];
