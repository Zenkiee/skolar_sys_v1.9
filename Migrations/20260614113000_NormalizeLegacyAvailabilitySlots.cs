using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using inMVC.Data;

#nullable disable

namespace inMVC.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260614113000_NormalizeLegacyAvailabilitySlots")]
    public partial class NormalizeLegacyAvailabilitySlots : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                INSERT INTO TutorAvailabilities (TutorId, Date, Time)
                SELECT DISTINCT firstSlot.TutorId, firstSlot.Date, '9:00 AM - 11:00 AM'
                FROM TutorAvailabilities AS firstSlot
                WHERE firstSlot.Time = '9:00 AM - 10:00 AM'
                  AND EXISTS (
                      SELECT 1
                      FROM TutorAvailabilities AS secondSlot
                      WHERE secondSlot.TutorId = firstSlot.TutorId
                        AND secondSlot.Date = firstSlot.Date
                        AND secondSlot.Time = '10:00 AM - 11:00 AM'
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM TutorAvailabilities AS existingSlot
                      WHERE existingSlot.TutorId = firstSlot.TutorId
                        AND existingSlot.Date = firstSlot.Date
                        AND existingSlot.Time = '9:00 AM - 11:00 AM'
                  );
            ");

            migrationBuilder.Sql(@"
                INSERT INTO TutorAvailabilities (TutorId, Date, Time)
                SELECT DISTINCT firstSlot.TutorId, firstSlot.Date, '1:00 PM - 3:00 PM'
                FROM TutorAvailabilities AS firstSlot
                WHERE firstSlot.Time = '1:00 PM - 2:00 PM'
                  AND EXISTS (
                      SELECT 1
                      FROM TutorAvailabilities AS secondSlot
                      WHERE secondSlot.TutorId = firstSlot.TutorId
                        AND secondSlot.Date = firstSlot.Date
                        AND secondSlot.Time = '2:00 PM - 3:00 PM'
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM TutorAvailabilities AS existingSlot
                      WHERE existingSlot.TutorId = firstSlot.TutorId
                        AND existingSlot.Date = firstSlot.Date
                        AND existingSlot.Time = '1:00 PM - 3:00 PM'
                  );
            ");

            migrationBuilder.Sql(@"
                DELETE FROM TutorAvailabilities
                WHERE Time IN (
                    '9:00 AM - 10:00 AM',
                    '10:00 AM - 11:00 AM',
                    '1:00 PM - 2:00 PM',
                    '2:00 PM - 3:00 PM',
                    '4:00 PM - 5:00 PM'
                );
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM TutorAvailabilities
                WHERE Time IN ('9:00 AM - 11:00 AM', '1:00 PM - 3:00 PM');
            ");
        }
    }
}
