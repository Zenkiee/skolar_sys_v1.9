using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using inMVC.Data;

#nullable disable

namespace inMVC.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260613180000_AddSessionCompletionConfirmation")]
public partial class AddSessionCompletionConfirmation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "CompletionIssueReason",
            table: "Bookings",
            type: "TEXT",
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<DateTime>(
            name: "CompletionIssueReportedAt",
            table: "Bookings",
            type: "TEXT",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "LearnerConfirmedDoneAt",
            table: "Bookings",
            type: "TEXT",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "TutorMarkedDoneAt",
            table: "Bookings",
            type: "TEXT",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "CompletionIssueReason", table: "Bookings");
        migrationBuilder.DropColumn(name: "CompletionIssueReportedAt", table: "Bookings");
        migrationBuilder.DropColumn(name: "LearnerConfirmedDoneAt", table: "Bookings");
        migrationBuilder.DropColumn(name: "TutorMarkedDoneAt", table: "Bookings");
    }
}
