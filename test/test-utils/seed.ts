import bcrypt from 'bcryptjs';
import User, { IUser } from '../../models/User';
import Salon, { ISalon } from '../../models/Salon';
import Service, { IService } from '../../models/Service';
import Booking from '../../models/Booking';

export interface SeedData {
  admin: IUser;
  stylist1: IUser;
  stylist2: IUser;
  salon: ISalon;
  service30: IService;
  service60: IService;
  passwords: {
    admin: string;
    stylist: string;
  };
}

export const seedTestDb = async (): Promise<SeedData> => {
  // Clear any existing data
  await Booking.deleteMany({});
  await Service.deleteMany({});
  await Salon.deleteMany({});
  await User.deleteMany({});

  const adminPassword = 'adminPassword123';
  const stylistPassword = 'stylistPassword123';

  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  const hashedStylistPassword = await bcrypt.hash(stylistPassword, 10);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@salon.test',
    password: hashedAdminPassword,
    role: 'admin'
  });

  const stylist1 = await User.create({
    name: 'Stylist One',
    email: 'stylist1@salon.test',
    password: hashedStylistPassword,
    role: 'stylist'
  });

  const stylist2 = await User.create({
    name: 'Stylist Two',
    email: 'stylist2@salon.test',
    password: hashedStylistPassword,
    role: 'stylist'
  });

  const salon = await Salon.create({
    name: 'Test Salon',
    location: '123 Main Street',
    openTime: '09:00',
    closeTime: '18:00'
  });

  const service30 = await Service.create({
    name: 'Men Haircut (30m)',
    duration: 30,
    price: 30,
    salonId: salon._id
  });

  const service60 = await Service.create({
    name: 'Hair Coloring (60m)',
    duration: 60,
    price: 80,
    salonId: salon._id
  });

  return {
    admin,
    stylist1,
    stylist2,
    salon,
    service30,
    service60,
    passwords: {
      admin: adminPassword,
      stylist: stylistPassword
    }
  };
};
