using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using inMVC.Data;

#nullable disable

namespace inMVC.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260613150000_AddTutorNotifications")]
public partial class AddTutorNotifications : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTime>(
            name: "CreatedAt",
            table: "Bookings",
            type: "TEXT",
            nullable: false,
            defaultValue: new DateTime(2026, 6, 13, 0, 0, 0, DateTimeKind.Utc));

        migrationBuilder.CreateTable(
            name: "TutorNotificationSettings",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                TutorId = table.Column<int>(type: "INTEGER", nullable: false),
                EmailNotificationsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                PushNotificationsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                NewReviewAlertsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                LastNotificationReadAt = table.Column<DateTime>(type: "TEXT", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_TutorNotificationSettings", item => item.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_TutorNotificationSettings_TutorId",
            table: "TutorNotificationSettings",
            column: "TutorId",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "TutorNotificationSettings");

        migrationBuilder.DropColumn(
            name: "CreatedAt",
            table: "Bookings");
    }
}
