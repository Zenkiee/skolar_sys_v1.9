using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace inMVC.Migrations
{
    public partial class AddTutorTimeSlots : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Time",
                table: "TutorAvailabilities",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("UPDATE TutorAvailabilities SET Time = '9:00 AM - 10:00 AM' WHERE Time = '';");
            migrationBuilder.Sql("INSERT INTO TutorAvailabilities (TutorId, Date, Time) SELECT TutorId, Date, '10:00 AM - 11:00 AM' FROM TutorAvailabilities WHERE Time = '9:00 AM - 10:00 AM';");
            migrationBuilder.Sql("INSERT INTO TutorAvailabilities (TutorId, Date, Time) SELECT TutorId, Date, '1:00 PM - 2:00 PM' FROM TutorAvailabilities WHERE Time = '9:00 AM - 10:00 AM';");
            migrationBuilder.Sql("INSERT INTO TutorAvailabilities (TutorId, Date, Time) SELECT TutorId, Date, '2:00 PM - 3:00 PM' FROM TutorAvailabilities WHERE Time = '9:00 AM - 10:00 AM';");
            migrationBuilder.Sql("INSERT INTO TutorAvailabilities (TutorId, Date, Time) SELECT TutorId, Date, '4:00 PM - 5:00 PM' FROM TutorAvailabilities WHERE Time = '9:00 AM - 10:00 AM';");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Time",
                table: "TutorAvailabilities");
        }
    }
}
