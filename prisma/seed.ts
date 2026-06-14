import { PrismaClient, UserRole, MembershipEventType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Seed Currencies
  const currencies = [
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'USD', name: 'United States Dollar', symbol: '$' },
  ];

  for (const cur of currencies) {
    await prisma.currency.upsert({
      where: { code: cur.code },
      update: {},
      create: cur,
    });
  }
  console.log('Currencies seeded.');

  // 2. Seed Exchange Rates
  const defaultRate = {
    fromCurrency: 'USD',
    toCurrency: 'INR',
    rate: 83.50,
    effectiveDate: new Date('2026-02-01T00:00:00Z'),
  };

  const existingRate = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: 'USD',
      toCurrency: 'INR',
    },
  });

  if (!existingRate) {
    await prisma.exchangeRate.create({
      data: defaultRate,
    });
  }
  console.log('Exchange rates seeded.');

  // 3. Seed Users
  const userSeeds: { name: string; role: UserRole }[] = [
    { name: 'Aisha', role: UserRole.MEMBER },
    { name: 'Rohan', role: UserRole.MEMBER },
    { name: 'Priya', role: UserRole.MEMBER },
    { name: 'Meera', role: UserRole.MEMBER },
    { name: 'Dev', role: UserRole.MEMBER },
    { name: 'Sam', role: UserRole.MEMBER },
    { name: 'Kabir', role: UserRole.GUEST },
  ];

  const seededUsers: Record<string, any> = {};

  for (const u of userSeeds) {
    const plainPassword = `${u.name.toLowerCase()}123`;
    const hashedPassword = await bcrypt.hash(plainPassword, 12);
    const email = `${u.name.toLowerCase()}@settleup.com`;

    const user = await prisma.user.upsert({
      where: { email: email },
      update: {
        passwordHash: hashedPassword,
        isGuest: false,
      },
      create: {
        name: u.name,
        email,
        passwordHash: hashedPassword,
        isGuest: false,
        role: u.role,
      },
    });
    seededUsers[u.name] = user;
    console.log(`Seeded user: ${u.name} (Role: ${u.role}, Password: ${plainPassword})`);
  }

  // 4. Seed Group
  const group = await prisma.group.upsert({
    where: { name: 'Spreetail Flatmates' },
    update: {},
    create: {
      name: 'Spreetail Flatmates',
    },
  });
  console.log('Group seeded: Spreetail Flatmates');

  // 5. Seed memberships & history
  const feb1 = new Date('2026-02-01T00:00:00Z');
  const initialMembers = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev'];

  for (const name of initialMembers) {
    const user = seededUsers[name];
    
    await prisma.groupMembership.upsert({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        groupId: group.id,
        userId: user.id,
        joinedAt: feb1,
      },
    });

    await prisma.membershipHistory.create({
      data: {
        groupId: group.id,
        userId: user.id,
        eventDate: feb1,
        eventType: MembershipEventType.JOIN,
        notes: `${name} joined the house sharing group.`,
      },
    });
  }

  // Meera left on Sunday March 29, 2026
  const meeraLeftDate = new Date('2026-03-29T23:59:59Z');
  const meeraUser = seededUsers['Meera'];
  await prisma.groupMembership.update({
    where: {
      groupId_userId: {
        groupId: group.id,
        userId: meeraUser.id,
      },
    },
    data: {
      leftAt: meeraLeftDate,
    },
  });
  
  await prisma.membershipHistory.create({
    data: {
      groupId: group.id,
      userId: meeraUser.id,
      eventDate: meeraLeftDate,
      eventType: MembershipEventType.LEAVE,
      notes: 'Meera moved out of the house.',
    },
  });
  console.log('Meera membership history configured (Exit: 2026-03-29).');

  // Sam joined on April 8, 2026
  const samJoinDate = new Date('2026-04-08T00:00:00Z');
  const samUser = seededUsers['Sam'];

  await prisma.groupMembership.upsert({
    where: {
      groupId_userId: {
        groupId: group.id,
        userId: samUser.id,
      },
    },
    update: {},
    create: {
      groupId: group.id,
      userId: samUser.id,
      joinedAt: samJoinDate,
    },
  });

  await prisma.membershipHistory.create({
    data: {
      groupId: group.id,
      userId: samUser.id,
      eventDate: samJoinDate,
      eventType: MembershipEventType.JOIN,
      notes: 'Sam moved into the house and joined the group.',
    },
  });
  console.log('Sam membership history configured (Entry: 2026-04-08).');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
